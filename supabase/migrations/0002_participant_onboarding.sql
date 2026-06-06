-- =============================================================================
-- 0002 — participant self-onboarding (Phase 1)
-- Lets a participant join a trip by entering their name/email/gender, instead of
-- being pre-seeded. Email collection satisfies NEEDS §6. Runs server-side
-- (SECURITY DEFINER) since RLS exposes only SELECT to the public.
-- =============================================================================

-- Reuse an existing participant when the same email re-registers within a trip,
-- so returning on a new device doesn't create duplicates.
create or replace function register_participant(
  p_trip_id uuid,
  p_name    text,
  p_email   text,
  p_gender  text
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

  perform 1 from trips where id = p_trip_id;
  if not found then
    raise exception 'TRIP_NOT_FOUND';
  end if;

  if p_email is not null and length(trim(p_email)) > 0 then
    select id into v_id
    from participants
    where trip_id = p_trip_id and lower(email) = lower(trim(p_email))
    limit 1;

    if found then
      update participants
        set name = trim(p_name),
            gender = nullif(p_gender, '')::gender
      where id = v_id;
      return v_id;
    end if;
  end if;

  insert into participants (trip_id, name, email, gender)
  values (p_trip_id, trim(p_name), nullif(trim(p_email), ''), nullif(p_gender, '')::gender)
  returning id into v_id;

  return v_id;
end;
$$;
