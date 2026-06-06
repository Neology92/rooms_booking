-- =============================================================================
-- Rooms Booking — initial schema
-- Enforces the hard invariants from NEEDS.md §10 at the database level:
--   1. A participant is in at most ONE room   -> UNIQUE(assignments.participant_id)
--   2. A room never exceeds its capacity       -> checked inside join_room() under a row lock
--   3. When signups are locked, participants cannot change assignments
--   4. (signalling of MUST HAVE violations is computed in the app from `rules`)
-- All participant-facing mutations go through SECURITY DEFINER functions so the
-- rules are enforced on the server, never only in the client (NEEDS / CLAUDE §2).
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------- enums ------------------------------------------------------------
do $$ begin
  create type gender as enum ('male', 'female', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type rule_type as enum ('same_gender', 'preferred_person');
exception when duplicate_object then null; end $$;

do $$ begin
  create type rule_strictness as enum ('must_have', 'preference');
exception when duplicate_object then null; end $$;

-- ---------- tables -----------------------------------------------------------
create table if not exists trips (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  target_headcount int,
  signups_locked   boolean not null default false,
  created_at       timestamptz not null default now()
);

create table if not exists rooms (
  id        uuid primary key default gen_random_uuid(),
  trip_id   uuid not null references trips(id) on delete cascade,
  name      text not null,
  capacity  int  not null check (capacity > 0),
  info      text,
  created_at timestamptz not null default now()
);
create index if not exists rooms_trip_id_idx on rooms(trip_id);

create table if not exists participants (
  id       uuid primary key default gen_random_uuid(),
  trip_id  uuid not null references trips(id) on delete cascade,
  name     text not null,
  email    text,
  gender   gender,
  created_at timestamptz not null default now()
);
create index if not exists participants_trip_id_idx on participants(trip_id);

-- One row per participant  ->  enforces "one room per person" (invariant #1).
create table if not exists assignments (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references trips(id) on delete cascade,
  participant_id uuid not null unique references participants(id) on delete cascade,
  room_id        uuid not null references rooms(id) on delete cascade,
  created_at     timestamptz not null default now()
);
create index if not exists assignments_room_id_idx on assignments(room_id);

create table if not exists rules (
  id                   uuid primary key default gen_random_uuid(),
  participant_id       uuid not null references participants(id) on delete cascade,
  type                 rule_type not null,
  strictness           rule_strictness not null default 'preference',
  target_participant_id uuid references participants(id) on delete cascade,
  created_at           timestamptz not null default now()
);
create index if not exists rules_participant_id_idx on rules(participant_id);

-- ---------- atomic participant operations -----------------------------------

-- Join (or move to) a room. Atomic "leave A + join B": the UNIQUE on
-- participant_id plus ON CONFLICT means a participant only ever holds one room,
-- with no intermediate double-membership. A row lock on the target room
-- serializes concurrent joiners so the capacity check is race-safe (invariant #2).
create or replace function join_room(p_participant_id uuid, p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id  uuid;
  v_capacity int;
  v_locked   boolean;
  v_count    int;
begin
  -- Lock the room row first; all concurrent joins to this room serialize here.
  select r.trip_id, r.capacity into v_trip_id, v_capacity
  from rooms r where r.id = p_room_id for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  select t.signups_locked into v_locked from trips t where t.id = v_trip_id;
  if v_locked then
    raise exception 'SIGNUPS_LOCKED';
  end if;

  perform 1 from participants p
    where p.id = p_participant_id and p.trip_id = v_trip_id;
  if not found then
    raise exception 'PARTICIPANT_NOT_IN_TRIP';
  end if;

  -- Count occupants while holding the room lock. If the participant is already
  -- in this room, moving is a no-op and must not be blocked by a full count.
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

-- Leave the current room. Blocked while signups are locked (invariant #3).
create or replace function leave_room(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked boolean;
begin
  select t.signups_locked into v_locked
  from assignments a join trips t on t.id = a.trip_id
  where a.participant_id = p_participant_id;

  if v_locked then
    raise exception 'SIGNUPS_LOCKED';
  end if;

  delete from assignments where participant_id = p_participant_id;
end;
$$;

-- Organizer: toggle the global sign-up lock (NEEDS §3). Enforced server-side.
-- NOTE: organizer-only authorization is a follow-up (see CLAUDE.md) — once auth
-- is wired, restrict this to the trip's organizer.
create or replace function set_signups_lock(p_trip_id uuid, p_locked boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update trips set signups_locked = p_locked where id = p_trip_id;
  if not found then
    raise exception 'TRIP_NOT_FOUND';
  end if;
end;
$$;

-- ---------- row level security ----------------------------------------------
-- MVP policy: public read so everyone sees live occupancy; writes that touch
-- invariants go through the SECURITY DEFINER functions above. Tightening these
-- (proper auth, organizer-only writes) is tracked as a follow-up — see CLAUDE.md.
alter table trips        enable row level security;
alter table rooms        enable row level security;
alter table participants enable row level security;
alter table assignments  enable row level security;
alter table rules        enable row level security;

do $$ begin
  create policy "public read trips"        on trips        for select using (true);
  create policy "public read rooms"        on rooms        for select using (true);
  create policy "public read participants" on participants for select using (true);
  create policy "public read assignments"  on assignments  for select using (true);
  create policy "public read rules"        on rules        for select using (true);
exception when duplicate_object then null; end $$;

-- ---------- realtime ---------------------------------------------------------
-- Live occupancy preview (NEEDS §4/§5): publish the tables the UI subscribes to.
do $$ begin
  alter publication supabase_realtime add table assignments;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table rooms;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table trips;
exception when duplicate_object then null; end $$;
