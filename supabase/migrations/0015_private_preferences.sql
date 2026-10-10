-- =============================================================================
-- 0015 — preferencje przestają być publiczne
-- Do tej pory `rules` i `pairing_requests` miały politykę `select using (true)`,
-- więc KAŻDY z kluczem anon (a ten jest publiczny w paczce JS) mógł odczytać,
-- kto z kim chce mieszkać i czyje MUST-HAVE jest niespełnione. Ukrycie panelu
-- w UI tego nie zamyka — granica musi być w bazie.
--
-- Podział dostępu:
--   * publiczne zostają pokoje / obłożenie / imiona — tego wymaga NEEDS §4
--     („kto konkretnie jest w danym pokoju"), widok uczestnika już to pokazuje;
--   * uczestnik czyta WYŁĄCZNIE swoje reguły i swoje prośby (model zaufania jak
--     w zapisach: klient podaje własne participant_id);
--   * organizator czyta komplet, ale tylko po weryfikacji kodu (assert_organizer).
--
-- UWAGA (realtime): po odebraniu publicznego SELECT-a klient anon przestaje
-- dostawać zdarzenia postgres_changes z tych tabel (realtime respektuje RLS).
-- Dla `rules` nie ma to znaczenia (zmienia je tylko właściciel). Dla
-- `pairing_requests` front nadrabia to odpytywaniem własnych prośb — patrz
-- useTripData.
--
-- E-maile i płeć uczestników pozostają na razie publicznie czytelne — świadomie
-- odłożone, odnotowane jako otwarty dług (CLAUDE.md §8.2).
-- =============================================================================

drop policy if exists "public read rules" on rules;
drop policy if exists "public read pairing_requests" on pairing_requests;

-- ---- odczyty uczestnika (trust-based, jak istniejące zapisy) -----------------

create or replace function get_my_rules(p_participant_id uuid)
returns setof rules
language sql
security definer
set search_path = public
as $$
  select * from rules where participant_id = p_participant_id;
$$;

create or replace function get_my_pairings(p_participant_id uuid)
returns setof pairing_requests
language sql
security definer
set search_path = public
as $$
  select * from pairing_requests
  where from_participant_id = p_participant_id
     or to_participant_id   = p_participant_id;
$$;

-- ---- odczyty organizatora (kod weryfikowany po stronie serwera) -------------
-- search_path zawiera `extensions`, bo assert_organizer woła crypt() z pgcrypto
-- (ta sama pułapka, którą naprawiała migracja 0008).

create or replace function get_trip_rules(p_trip_id uuid, p_passcode text)
returns setof rules
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform assert_organizer(p_trip_id, p_passcode);
  return query
    select r.*
    from rules r
    join participants p on p.id = r.participant_id
    where p.trip_id = p_trip_id;
end;
$$;

create or replace function get_trip_pairings(p_trip_id uuid, p_passcode text)
returns setof pairing_requests
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform assert_organizer(p_trip_id, p_passcode);
  return query
    select * from pairing_requests where trip_id = p_trip_id;
end;
$$;
