-- =============================================================================
-- 0004 — organizer manual overrides (Phase 3, NEEDS §5)
-- The organizer can place/move/remove participants directly from the dashboard.
-- Unlike join_room/leave_room, these bypass the signups lock (arranging rooms is
-- exactly what the organizer does after locking), but STILL enforce the hard
-- invariants: room capacity and one-room-per-person (NEEDS §10).
-- Organizer-only authorization is a follow-up (see CLAUDE.md §7), same as
-- set_signups_lock — for now these run as SECURITY DEFINER without a role check.
-- =============================================================================

create or replace function admin_assign(p_participant_id uuid, p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id  uuid;
  v_capacity int;
  v_count    int;
begin
  select r.trip_id, r.capacity into v_trip_id, v_capacity
  from rooms r where r.id = p_room_id for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  perform 1 from participants p
    where p.id = p_participant_id and p.trip_id = v_trip_id;
  if not found then
    raise exception 'PARTICIPANT_NOT_IN_TRIP';
  end if;

  select count(*) into v_count
  from assignments a
  where a.room_id = p_room_id and a.participant_id <> p_participant_id;
  if v_count >= v_capacity then
    raise exception 'ROOM_FULL';
  end if;

  insert into assignments (trip_id, participant_id, room_id)
  values (v_trip_id, p_participant_id, p_room_id)
  on conflict (participant_id)
  do update set room_id = excluded.room_id, trip_id = excluded.trip_id;
end;
$$;

create or replace function admin_unassign(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from assignments where participant_id = p_participant_id;
end;
$$;