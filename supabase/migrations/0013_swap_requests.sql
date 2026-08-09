-- =============================================================================
-- 0013 — participant-initiated SWAP proposals (UX v2 #1)
-- A participant already in a room can propose swapping rooms with someone in a
-- different room. On accept the two exchange rooms atomically — so it reuses the
-- pairing_requests negotiation surface but ACTS on acceptance instead of just
-- recording a preference.
--   - new request kind 'swap' (existing rows are kind 'pair')
--   - new terminal status 'completed' (an executed swap is NOT an ongoing pairing,
--     so it must NOT be folded into preferences by effectiveRules, which only
--     looks at 'accepted', and must free the pair in the active-pair index)
-- Swaps are blocked while sign-ups are locked (§10.3); swapping preserves room
-- occupancy so capacity/one-room (§10.1/§10.2) always hold.
-- =============================================================================

do $$ begin
  alter type pairing_status add value if not exists 'completed';
exception when duplicate_object then null; end $$;

alter table pairing_requests
  add column if not exists kind text not null default 'pair'
    check (kind in ('pair', 'swap', 'invite'));

-- SEND a swap proposal: both must be assigned, to DIFFERENT rooms in the trip.
create or replace function send_swap_request(p_from uuid, p_to uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip      uuid;
  v_id        uuid;
  v_room_from uuid;
  v_room_to   uuid;
begin
  if p_from = p_to then
    raise exception 'TARGET_IS_SELF';
  end if;

  select trip_id into v_trip from participants where id = p_from;
  if not found then
    raise exception 'PARTICIPANT_NOT_IN_TRIP';
  end if;
  perform 1 from participants where id = p_to and trip_id = v_trip;
  if not found then
    raise exception 'PARTICIPANT_NOT_IN_TRIP';
  end if;

  select room_id into v_room_from from assignments where participant_id = p_from;
  if not found then
    raise exception 'PARTICIPANT_NOT_ASSIGNED';
  end if;
  select room_id into v_room_to from assignments where participant_id = p_to;
  if not found then
    raise exception 'PARTICIPANT_NOT_ASSIGNED';
  end if;
  if v_room_from = v_room_to then
    raise exception 'SAME_ROOM';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(least(p_from, p_to)::text || '/' || greatest(p_from, p_to)::text)::bigint
  );

  perform 1 from pairing_requests
    where status in ('pending', 'accepted')
      and least(from_participant_id, to_participant_id)    = least(p_from, p_to)
      and greatest(from_participant_id, to_participant_id) = greatest(p_from, p_to);
  if found then
    raise exception 'PAIRING_EXISTS';
  end if;

  insert into pairing_requests (trip_id, from_participant_id, to_participant_id, kind)
  values (v_trip, p_from, p_to, 'swap')
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'PAIRING_EXISTS';
end;
$$;

-- RESPOND now branches on kind: 'pair' records acceptance (unchanged); 'swap'
-- executes the room exchange atomically and marks the request 'completed'.
create or replace function respond_pairing_request(
  p_participant_id uuid,
  p_request_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v           pairing_requests%rowtype;
  v_locked    boolean;
  v_room_from uuid;
  v_room_to   uuid;
begin
  select * into v from pairing_requests where id = p_request_id for update;
  if not found then
    raise exception 'PAIRING_NOT_FOUND';
  end if;
  if v.to_participant_id <> p_participant_id then
    raise exception 'NOT_RECIPIENT';
  end if;
  if v.status <> 'pending' then
    raise exception 'PAIRING_NOT_PENDING';
  end if;

  if not p_accept then
    update pairing_requests set status = 'declined', updated_at = now()
    where id = p_request_id;
    return;
  end if;

  if v.kind = 'swap' then
    select signups_locked into v_locked from trips where id = v.trip_id;
    if v_locked then
      raise exception 'SIGNUPS_LOCKED';
    end if;
    select room_id into v_room_from from assignments
      where participant_id = v.from_participant_id for update;
    if not found then
      raise exception 'PARTICIPANT_NOT_ASSIGNED';
    end if;
    select room_id into v_room_to from assignments
      where participant_id = v.to_participant_id for update;
    if not found then
      raise exception 'PARTICIPANT_NOT_ASSIGNED';
    end if;
    if v_room_from = v_room_to then
      raise exception 'SAME_ROOM';
    end if;
    update assignments set room_id = v_room_to where participant_id = v.from_participant_id;
    update assignments set room_id = v_room_from where participant_id = v.to_participant_id;
    update pairing_requests set status = 'completed', updated_at = now()
    where id = p_request_id;
  else
    update pairing_requests set status = 'accepted', updated_at = now()
    where id = p_request_id;
  end if;
end;
$$;
