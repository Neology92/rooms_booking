-- =============================================================================
-- 0014 — room invitations (UX v2 #2)
-- A participant in a room can invite someone to join them. On acceptance the
-- invited person moves to the inviter's current room atomically — capacity
-- and lock are checked at accept-time (not send-time) so stale invites fail
-- safely. Uses the pairing_requests surface with kind='invite' (the CHECK
-- constraint already allows it from 0013).
--   - send_room_invite: inviter must be assigned; target in the same trip
--   - respond_pairing_request: invite accept = move to inviter's room
-- Invites are blocked while sign-ups are locked (§10.3); capacity is enforced
-- server-side (§10.2); one-room-per-person is preserved by INSERT ON CONFLICT.
-- =============================================================================

-- SEND a room invitation: inviter must be in a room, target must be in the trip
-- and NOT already in the same room.
create or replace function send_room_invite(p_from uuid, p_to uuid)
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
  if found and v_room_from = v_room_to then
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
  values (v_trip, p_from, p_to, 'invite')
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'PAIRING_EXISTS';
end;
$$;

-- RESPOND: add invite branch alongside pair and swap.
-- On invite accept: check lock, find inviter's current room, lock room row,
-- check capacity, move invited person in (INSERT ON CONFLICT), mark completed.
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
  v_capacity  int;
  v_count     int;
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

  elsif v.kind = 'invite' then
    select signups_locked into v_locked from trips where id = v.trip_id;
    if v_locked then
      raise exception 'SIGNUPS_LOCKED';
    end if;
    select room_id into v_room_from from assignments
      where participant_id = v.from_participant_id;
    if not found then
      raise exception 'PARTICIPANT_NOT_ASSIGNED';
    end if;
    select capacity into v_capacity from rooms
      where id = v_room_from for update;
    select count(*) into v_count from assignments
      where room_id = v_room_from and participant_id <> p_participant_id;
    if v_count >= v_capacity then
      raise exception 'ROOM_FULL';
    end if;
    insert into assignments (trip_id, participant_id, room_id)
    values (v.trip_id, p_participant_id, v_room_from)
    on conflict (participant_id)
    do update set room_id = excluded.room_id, trip_id = excluded.trip_id;
    update pairing_requests set status = 'completed', updated_at = now()
    where id = p_request_id;

  else
    update pairing_requests set status = 'accepted', updated_at = now()
    where id = p_request_id;
  end if;
end;
$$;
