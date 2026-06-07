-- =============================================================================
-- 0003 — participant-managed rules (Phase 2)
-- Participants set their own roommate rules (NEEDS §7/§8): same-gender and a
-- preferred person, each either a soft preference (default) or a hard MUST-HAVE.
-- Writes go through SECURITY DEFINER RPCs since RLS exposes only SELECT.
-- A participant holds at most one rule per type, so set_rule replaces in place.
-- =============================================================================

create or replace function set_rule(
  p_participant_id uuid,
  p_type           text,
  p_strictness     text,
  p_target_participant_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_id      uuid;
begin
  select trip_id into v_trip_id from participants where id = p_participant_id;
  if not found then
    raise exception 'PARTICIPANT_NOT_IN_TRIP';
  end if;

  if p_type = 'preferred_person' then
    if p_target_participant_id is null then
      raise exception 'TARGET_REQUIRED';
    end if;
    if p_target_participant_id = p_participant_id then
      raise exception 'TARGET_IS_SELF';
    end if;
    perform 1 from participants
      where id = p_target_participant_id and trip_id = v_trip_id;
    if not found then
      raise exception 'PARTICIPANT_NOT_IN_TRIP';
    end if;
  end if;

  -- One rule per (participant, type): replace any existing one.
  delete from rules
    where participant_id = p_participant_id and type = p_type::rule_type;

  insert into rules (participant_id, type, strictness, target_participant_id)
  values (
    p_participant_id,
    p_type::rule_type,
    p_strictness::rule_strictness,
    case when p_type = 'preferred_person' then p_target_participant_id end
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function clear_rule(p_participant_id uuid, p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from rules
    where participant_id = p_participant_id and type = p_type::rule_type;
end;
$$;

-- Live updates for rules and participants (so new sign-ups and rule changes show
-- up in real time, NEEDS §4/§5). assignments/rooms/trips were added in 0001.
do $$ begin
  alter publication supabase_realtime add table rules;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table participants;
exception when duplicate_object then null; end $$;
