-- =============================================================================
-- 0010 — negotiated roommate requests (DIRECTION.md; PreferenceRequest{from,to,status})
-- A participant asks another to room together; the other accepts/declines; the
-- sender can withdraw a pending one; either party can end an accepted pairing.
-- An ACCEPTED pairing is a MUTUAL soft preference — it is NEVER written to the
-- `rules` table; instead the app folds accepted rows into two synthetic
-- bidirectional `preferred_person`/`preference` rules at evaluation time
-- (see src/lib/rules.ts effectiveRules). So this feature only influences
-- signalling + swap proposals and CANNOT touch assignments/capacity/lock — NEEDS
-- §10 stays intact. Trust-based participant RPCs (client passes its own
-- participant_id, same model as join_room/set_rule).
-- =============================================================================

do $$ begin
  create type pairing_status as enum
    ('pending', 'accepted', 'declined', 'withdrawn', 'ended');
exception when duplicate_object then null; end $$;

create table if not exists pairing_requests (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid not null references trips(id)        on delete cascade,
  from_participant_id uuid not null references participants(id) on delete cascade,
  to_participant_id   uuid not null references participants(id) on delete cascade,
  status              pairing_status not null default 'pending',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint pairing_no_self check (from_participant_id <> to_participant_id)
);

create index if not exists pairing_requests_trip_idx on pairing_requests(trip_id);
create index if not exists pairing_requests_from_idx on pairing_requests(from_participant_id);
create index if not exists pairing_requests_to_idx   on pairing_requests(to_participant_id);

-- Core invariant: at most ONE active (pending|accepted) pairing per UNORDERED
-- pair. least()/greatest() on uuid are immutable, so this expression index is
-- valid. It is the race-safe backstop behind the friendly checks in the RPCs:
-- blocks duplicate sends, A->B and B->A both pending, and re-send-while-active.
-- declined/withdrawn/ended rows are excluded, so they are pure history that
-- never blocks a later resend.
create unique index if not exists pairing_requests_active_pair_uidx
  on pairing_requests (
    least(from_participant_id, to_participant_id),
    greatest(from_participant_id, to_participant_id)
  )
  where status in ('pending', 'accepted');

-- MVP RLS: public read (live incoming/outgoing/accepted lists); writes only via
-- the SECURITY DEFINER RPCs below (mirrors 0001/0003).
alter table pairing_requests enable row level security;
do $$ begin
  create policy "public read pairing_requests"
    on pairing_requests for select using (true);
exception when duplicate_object then null; end $$;

-- Realtime (NEEDS §4/§5): negotiation lists + dashboard signalling update live.
do $$ begin
  alter publication supabase_realtime add table pairing_requests;
exception when duplicate_object then null; end $$;

-- ---- RPCs (trust-based; caller passes its own participant_id) ----------------

-- SEND: A -> B. Rejects an existing active pairing for the pair (PAIRING_EXISTS).
create or replace function send_pairing_request(p_from uuid, p_to uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip uuid;
  v_id   uuid;
begin
  if p_from = p_to then
    raise exception 'TARGET_IS_SELF';
  end if;

  select trip_id into v_trip from participants where id = p_from;
  if not found then
    raise exception 'PARTICIPANT_NOT_IN_TRIP';
  end if;

  -- Recipient must exist AND be in the same trip (blocks cross-trip requests).
  perform 1 from participants where id = p_to and trip_id = v_trip;
  if not found then
    raise exception 'PARTICIPANT_NOT_IN_TRIP';
  end if;

  -- Serialize concurrent sends for this unordered pair so a simultaneous
  -- A->B / B->A resolves to exactly one row (belt-and-braces with the index).
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

  insert into pairing_requests (trip_id, from_participant_id, to_participant_id)
  values (v_trip, p_from, p_to)
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'PAIRING_EXISTS';
end;
$$;

-- RESPOND: recipient accepts/declines a pending request.
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
  v_to     uuid;
  v_status pairing_status;
begin
  select to_participant_id, status into v_to, v_status
  from pairing_requests where id = p_request_id for update;
  if not found then
    raise exception 'PAIRING_NOT_FOUND';
  end if;
  if v_to <> p_participant_id then
    raise exception 'NOT_RECIPIENT';
  end if;
  if v_status <> 'pending' then
    raise exception 'PAIRING_NOT_PENDING';
  end if;

  update pairing_requests
    set status = (case when p_accept then 'accepted' else 'declined' end)::pairing_status,
        updated_at = now()
  where id = p_request_id;
end;
$$;

-- WITHDRAW: sender cancels their own pending request.
create or replace function withdraw_pairing_request(
  p_participant_id uuid,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from   uuid;
  v_status pairing_status;
begin
  select from_participant_id, status into v_from, v_status
  from pairing_requests where id = p_request_id for update;
  if not found then
    raise exception 'PAIRING_NOT_FOUND';
  end if;
  if v_from <> p_participant_id then
    raise exception 'NOT_SENDER';
  end if;
  if v_status <> 'pending' then
    raise exception 'PAIRING_NOT_PENDING';
  end if;

  update pairing_requests set status = 'withdrawn', updated_at = now()
  where id = p_request_id;
end;
$$;

-- END: either party dissolves an accepted pairing (distinct 'ended' status so
-- history stays legible; frees the pair to be re-requested later).
create or replace function end_pairing(
  p_participant_id uuid,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from   uuid;
  v_to     uuid;
  v_status pairing_status;
begin
  select from_participant_id, to_participant_id, status
    into v_from, v_to, v_status
  from pairing_requests where id = p_request_id for update;
  if not found then
    raise exception 'PAIRING_NOT_FOUND';
  end if;
  if p_participant_id not in (v_from, v_to) then
    raise exception 'NOT_PARTICIPANT';
  end if;
  if v_status <> 'accepted' then
    raise exception 'PAIRING_NOT_ACCEPTED';
  end if;

  update pairing_requests set status = 'ended', updated_at = now()
  where id = p_request_id;
end;
$$;
