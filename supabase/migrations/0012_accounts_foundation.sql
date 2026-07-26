-- =============================================================================
-- 0012 — accounts foundation (v2, ADDITIVE — nothing existing breaks)
-- Introduces real per-user identity columns ahead of the auth cutover:
--   - trips.organizer_user_id  → the owner (auth user) of a trip
--   - trips.code               → short human-friendly join code (share this, not the uuid)
--   - participants.user_id     → links a participant row to an auth user
-- The auth-gated RPCs and RLS come in a follow-up migration; this one only adds
-- columns/indexes and backfills codes, so the current passcode/localStorage flow
-- keeps working while the new auth UI is built.
-- =============================================================================

alter table trips
  add column if not exists organizer_user_id uuid references auth.users(id) on delete set null;

alter table participants
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Short, shareable join code (uppercase, derived from the id for existing rows;
-- new trips get a collision-checked code from the v2 create RPC later).
alter table trips add column if not exists code text;
update trips set code = upper(substr(md5(id::text), 1, 6)) where code is null;
create unique index if not exists trips_code_uidx on trips(code);

-- A user is at most one participant per trip (one-account-one-seat).
create unique index if not exists participants_user_trip_uidx
  on participants(trip_id, user_id) where user_id is not null;
create index if not exists participants_user_idx on participants(user_id);
create index if not exists trips_organizer_user_idx on trips(organizer_user_id);
