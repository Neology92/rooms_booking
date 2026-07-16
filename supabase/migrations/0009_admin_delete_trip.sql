-- =============================================================================
-- 0009 — organizer can delete a trip (NEEDS §2; also enables test cleanup)
-- Cascades to rooms/participants/assignments/rules via their ON DELETE CASCADE
-- foreign keys. Organizer-only.
-- =============================================================================

create or replace function admin_delete_trip(p_trip_id uuid, p_passcode text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform assert_organizer(p_trip_id, p_passcode);
  delete from trips where id = p_trip_id;
end;
$$;
