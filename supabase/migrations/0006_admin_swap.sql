-- =============================================================================
-- 0006 — atomic room swap for the optimizer (Phase 5, NEEDS §9)
-- Applies a proposed swap: two assigned participants exchange rooms in a single
-- transaction. Because it's a swap, each room's occupancy is unchanged, so
-- capacity (invariant §10.2) is preserved with no intermediate violation.
-- Organizer-only (reuses assert_organizer from 0005).
-- =============================================================================

create or replace function admin_swap(
  p_a uuid,
  p_b uuid,
  p_passcode text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip   uuid;
  v_room_a uuid;
  v_room_b uuid;
begin
  if p_a = p_b then
    raise exception 'TARGET_IS_SELF';
  end if;

  -- Lock both assignment rows in a stable order to avoid deadlocks.
  select trip_id, room_id into v_trip, v_room_a
  from assignments where participant_id = least(p_a, p_b) for update;
  if not found then
    raise exception 'PARTICIPANT_NOT_ASSIGNED';
  end if;

  perform assert_organizer(v_trip, p_passcode);

  select room_id into v_room_b
  from assignments where participant_id = greatest(p_a, p_b) for update;
  if not found then
    raise exception 'PARTICIPANT_NOT_ASSIGNED';
  end if;

  -- Note: v_room_a belongs to least(p_a,p_b), v_room_b to greatest(p_a,p_b).
  update assignments set room_id = v_room_b where participant_id = least(p_a, p_b);
  update assignments set room_id = v_room_a where participant_id = greatest(p_a, p_b);
end;
$$;
