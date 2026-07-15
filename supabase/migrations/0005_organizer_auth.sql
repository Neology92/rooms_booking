-- =============================================================================
-- 0005 — organizer authorization (Phase 4, NEEDS §10.3)
-- Closes the open door: organizer actions (lock, manual overrides) were callable
-- by anyone with the anon key. Now each trip carries a hashed organizer passcode
-- (bcrypt via pgcrypto). The first person to set a passcode "claims" the trip;
-- afterwards changing it requires the current passcode. Every organizer RPC takes
-- the passcode and verifies it server-side, so authorization is enforced in the
-- database, never only in the UI (CLAUDE.md §2).
--
-- Zero-cost (NEEDS §11): no email, no external auth provider. Participants stay
-- account-less (self-onboarding). Upgrading to per-user Supabase accounts later
-- only touches these functions + the organizer login UI.
-- =============================================================================

alter table trips add column if not exists organizer_passcode_hash text;
alter table trips add column if not exists organizer_claimed boolean not null default false;

-- Claim a trip (first passcode) or rotate the passcode (needs the current one).
create or replace function set_organizer_passcode(
  p_trip_id uuid,
  p_current_passcode text,
  p_new_passcode text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  if p_new_passcode is null or length(p_new_passcode) < 4 then
    raise exception 'PASSCODE_TOO_SHORT';
  end if;

  select organizer_passcode_hash into v_hash from trips where id = p_trip_id;
  if not found then
    raise exception 'TRIP_NOT_FOUND';
  end if;

  -- Already claimed → require the current passcode to rotate it.
  if v_hash is not null then
    if p_current_passcode is null or v_hash <> crypt(p_current_passcode, v_hash) then
      raise exception 'NOT_ORGANIZER';
    end if;
  end if;

  update trips
    set organizer_passcode_hash = crypt(p_new_passcode, gen_salt('bf')),
        organizer_claimed = true
  where id = p_trip_id;
end;
$$;

-- Lightweight check used by the login form. Returns false for an unclaimed trip.
create or replace function verify_organizer(p_trip_id uuid, p_passcode text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  select organizer_passcode_hash into v_hash from trips where id = p_trip_id;
  if v_hash is null or p_passcode is null then
    return false;
  end if;
  return v_hash = crypt(p_passcode, v_hash);
end;
$$;

-- Internal: raise unless the passcode matches the trip's organizer passcode.
create or replace function assert_organizer(p_trip_id uuid, p_passcode text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  select organizer_passcode_hash into v_hash from trips where id = p_trip_id;
  if v_hash is null or p_passcode is null or v_hash <> crypt(p_passcode, v_hash) then
    raise exception 'NOT_ORGANIZER';
  end if;
end;
$$;

-- ---- re-create organizer RPCs with a passcode parameter --------------------
-- Drop the old (unauthorized) signatures so no open version lingers.
drop function if exists set_signups_lock(uuid, boolean);
drop function if exists admin_assign(uuid, uuid);
drop function if exists admin_unassign(uuid);

create or replace function set_signups_lock(
  p_trip_id uuid,
  p_locked boolean,
  p_passcode text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform assert_organizer(p_trip_id, p_passcode);
  update trips set signups_locked = p_locked where id = p_trip_id;
  if not found then
    raise exception 'TRIP_NOT_FOUND';
  end if;
end;
$$;

create or replace function admin_assign(
  p_participant_id uuid,
  p_room_id uuid,
  p_passcode text
)
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

  perform assert_organizer(v_trip_id, p_passcode);

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

create or replace function admin_unassign(
  p_participant_id uuid,
  p_passcode text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
begin
  select trip_id into v_trip_id from assignments where participant_id = p_participant_id;
  if not found then
    return; -- nothing to remove
  end if;
  perform assert_organizer(v_trip_id, p_passcode);
  delete from assignments where participant_id = p_participant_id;
end;
$$;
