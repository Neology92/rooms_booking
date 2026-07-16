-- =============================================================================
-- 0007 — trip & room management from the UI (NEEDS §2, §3)
-- So the organizer never touches SQL: create a trip (and claim it in one step),
-- then add/edit/remove rooms and set the target headcount. All room/trip writes
-- are organizer-only (assert_organizer, from 0005) and keep the hard invariants:
--   - capacity stays >= 1 and never below current occupancy (§10.2)
--   - a room with occupants can't be deleted out from under them
-- =============================================================================

-- Create a trip and immediately claim it with an organizer passcode.
create or replace function create_trip(
  p_name text,
  p_target_headcount int,
  p_passcode text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'NAME_REQUIRED';
  end if;
  if p_passcode is null or length(p_passcode) < 4 then
    raise exception 'PASSCODE_TOO_SHORT';
  end if;

  insert into trips (name, target_headcount, organizer_passcode_hash, organizer_claimed)
  values (
    trim(p_name),
    p_target_headcount,
    crypt(p_passcode, gen_salt('bf')),
    true
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function admin_create_room(
  p_trip_id uuid,
  p_name text,
  p_capacity int,
  p_info text,
  p_passcode text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform assert_organizer(p_trip_id, p_passcode);
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'NAME_REQUIRED';
  end if;
  if p_capacity is null or p_capacity < 1 then
    raise exception 'CAPACITY_INVALID';
  end if;

  insert into rooms (trip_id, name, capacity, info)
  values (p_trip_id, trim(p_name), p_capacity, nullif(trim(p_info), ''))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function admin_update_room(
  p_room_id uuid,
  p_name text,
  p_capacity int,
  p_info text,
  p_passcode text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip uuid;
  v_occ  int;
begin
  select trip_id into v_trip from rooms where id = p_room_id;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  perform assert_organizer(v_trip, p_passcode);

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'NAME_REQUIRED';
  end if;
  if p_capacity is null or p_capacity < 1 then
    raise exception 'CAPACITY_INVALID';
  end if;

  select count(*) into v_occ from assignments where room_id = p_room_id;
  if p_capacity < v_occ then
    raise exception 'CAPACITY_BELOW_OCCUPANCY';
  end if;

  update rooms
    set name = trim(p_name), capacity = p_capacity, info = nullif(trim(p_info), '')
  where id = p_room_id;
end;
$$;

create or replace function admin_delete_room(p_room_id uuid, p_passcode text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip uuid;
  v_occ  int;
begin
  select trip_id into v_trip from rooms where id = p_room_id;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  perform assert_organizer(v_trip, p_passcode);

  select count(*) into v_occ from assignments where room_id = p_room_id;
  if v_occ > 0 then
    raise exception 'ROOM_NOT_EMPTY';
  end if;

  delete from rooms where id = p_room_id;
end;
$$;

create or replace function admin_set_target(
  p_trip_id uuid,
  p_target int,
  p_passcode text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform assert_organizer(p_trip_id, p_passcode);
  update trips set target_headcount = p_target where id = p_trip_id;
  if not found then
    raise exception 'TRIP_NOT_FOUND';
  end if;
end;
$$;
