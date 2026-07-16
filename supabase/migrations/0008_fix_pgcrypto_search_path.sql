-- =============================================================================
-- 0008 — fix: pgcrypto lives in the `extensions` schema on Supabase
-- The organizer-auth functions (0005) and create_trip (0007) call crypt()/
-- gen_salt() but were created with `search_path = public`, so those symbols
-- weren't resolvable and every call failed at runtime with
-- "function gen_salt(unknown) does not exist". Add `extensions` to the search
-- path of exactly the functions that use pgcrypto.
-- =============================================================================

alter function assert_organizer(uuid, text)            set search_path = public, extensions;
alter function verify_organizer(uuid, text)            set search_path = public, extensions;
alter function set_organizer_passcode(uuid, text, text) set search_path = public, extensions;
alter function create_trip(text, integer, text)        set search_path = public, extensions;
