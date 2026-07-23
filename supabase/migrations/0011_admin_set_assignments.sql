-- =============================================================================
-- 0011 — atomically apply a full room-assignment plan (solver, NEEDS §9)
-- The on-demand solver (src/lib/solve.ts) computes a target arrangement that may
-- mix swaps AND relocations into spare capacity; applying it swap-by-swap would
-- race a live board, so this commits the whole plan in ONE transaction.
-- Organizer-only. Re-validates every §10 invariant server-side:
--   - one room per person (unique(participant_id) + upsert)
--   - room capacity never exceeded
--   - the plan covers EXACTLY the currently-assigned set (full-set contract), so
--     a concurrent sign-up/leave between solve and apply aborts cleanly instead
--     of silently over/under-filling — the organizer just re-runs.
-- Mirrors the 0005/0006 pattern (security definer, search_path=public, delegate
-- auth to assert_organizer). First RPC in this project to take array params.
-- =============================================================================

create or replace function admin_set_assignments(
  p_trip_id uuid,
  p_passcode text,
  p_participant_ids uuid[],
  p_room_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_len int := coalesce(array_length(p_participant_ids, 1), 0);
begin
  perform assert_organizer(p_trip_id, p_passcode);

  if v_len <> coalesce(array_length(p_room_ids, 1), 0) then
    raise exception 'ARRAY_LENGTH_MISMATCH';
  end if;

  -- one room per person: no duplicate participant in the plan
  if exists (
    select pid from unnest(p_participant_ids) as pid
    group by pid having count(*) > 1
  ) then
    raise exception 'DUPLICATE_PARTICIPANT';
  end if;

  -- every participant belongs to this trip
  if exists (
    select 1 from unnest(p_participant_ids) as u(pid)
    where not exists (
      select 1 from participants p where p.id = u.pid and p.trip_id = p_trip_id
    )
  ) then
    raise exception 'PARTICIPANT_NOT_IN_TRIP';
  end if;

  -- every target room belongs to this trip
  if exists (
    select 1 from unnest(p_room_ids) as u(rid)
    where not exists (
      select 1 from rooms r where r.id = u.rid and r.trip_id = p_trip_id
    )
  ) then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  -- Lock rooms then assignments (stable order) for race safety.
  perform 1 from rooms where trip_id = p_trip_id order by id for update;
  perform 1 from assignments where trip_id = p_trip_id order by participant_id for update;

  -- Full-set contract: the plan must cover exactly the currently-assigned set.
  if v_len <> (select count(*) from assignments where trip_id = p_trip_id)
     or exists (
       select unnest(p_participant_ids)
       except
       select participant_id from assignments where trip_id = p_trip_id
     )
     or exists (
       select participant_id from assignments where trip_id = p_trip_id
       except
       select unnest(p_participant_ids)
     )
  then
    raise exception 'ASSIGNMENT_SET_MISMATCH';
  end if;

  -- Capacity: with the full-set contract, per-room plan counts equal final
  -- occupancy, so this is the exact post-apply check.
  if exists (
    select 1
    from unnest(p_participant_ids, p_room_ids) as t(pid, rid)
    join rooms r on r.id = t.rid
    group by t.rid, r.capacity
    having count(*) > r.capacity
  ) then
    raise exception 'ROOM_FULL';
  end if;

  -- Commit the plan. Every participant already has a row (set matches current),
  -- so these are all updates; nobody is added or removed.
  insert into assignments (trip_id, participant_id, room_id)
  select p_trip_id, t.pid, t.rid
  from unnest(p_participant_ids, p_room_ids) as t(pid, rid)
  on conflict (participant_id) do update set room_id = excluded.room_id;
end;
$$;
