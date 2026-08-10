# ⚠️ TEMP — handoff (USUNĄĆ po zamknięciu buga `create_trip`)

> Plik tymczasowy. Kasujemy go, gdy bug `create_trip` będzie naprawiony i #1 (zamiany)
> zweryfikowane end-to-end. Nie jest częścią docelowej dokumentacji.

## 🔴 OSTATNI BUG (priorytet)
Na żywej stronie **`create_trip` pada** przy tworzeniu wyjazdu → czerwony „Coś poszło nie
tak. Spróbuj ponownie." (ogólny `UNKNOWN` = Postgres zwrócił komunikat nierozpoznany przez
front). Powtarzalne (użytkownik tworzył „Mazury26" z kodem organizatora → błąd). Dodatkowo
picker pokazuje **„Brak wyjazdów"** (lista `trips` pusta, choć wcześniej były ≥2 — sprawdzić
czy skasowane / RLS).

**Kontekst:** `create_trip` pochodzi z `0007`, `search_path` łatany w `0008` na
`public, extensions` (używa `crypt`/`gen_salt` z pgcrypto w schemacie `extensions`). Ani
`0012`, ani `0013` nie redefiniują `create_trip`, więc regresja niejasna — **potrzebny
dokładny błąd z bazy**. Podejrzenie: migracja `0013` nakładana przez użytkownika w OSOBNYM
czacie coś odtworzyła/zepsuła.

**Diagnostyka (uruchomić tam, gdzie Supabase MCP działa):**
```sql
select create_trip('DIAG', null, 'test1234');
select proname, proconfig from pg_proc where proname in ('create_trip','assert_organizer');
```
Jeśli przy `create_trip` w `proconfig` NIE ma `search_path=public,extensions` → to przyczyna.
**Prawdopodobny fix (idempotentny):**
```sql
alter function create_trip(text, integer, text) set search_path = public, extensions;
```
NIE naprawiać na ślepo — najpierw zobaczyć błąd. Sprawdzić też pustą listę wyjazdów.

## ⚠️ Blokada narzędzi
- **Supabase MCP w bieżącym czacie: `enabledInChat: false`** (uwierzytelniony, wyłączony dla
  czatu; toggle nie propaguje się do sesji). **Nie sięgnę bazy stąd.**
- Sandbox ma **zablokowany egress do `*.supabase.co`** (403 allowlist) → brak też
  bezpośredniego HTTP.
- **Workaround:** nowy czat z Supabase włączonym od startu, albo user uruchamia SQL w
  działającym czacie i wkleja wynik. Netlify MCP działa (nazwa `mcp__46b8eea0-...`).

## Aplikacja — kontekst
- Webowa (React+TS + Supabase) rejestracja uczestników do pokojów na wyjeździe grupowym.
  Mobile-first. Twarde wymagania: atomowość/współbieżność, realtime, lock po stronie serwera,
  MUST-HAVE vs preferencja, **§11 ZERO kosztów** (Supabase+Netlify free), **§12 UI EN**
  (jest EN/PL, domyślnie EN), invarianty §10.
- **Infra:** Supabase `zqxlxvgwydmxpfznizvg` (eu-central-1). Netlify site
  `f093866c-7b5d-427e-a0ad-ae95996cc0e5` (`neology-rooms-booking`, team `neology92`), prod
  https://neology-rooms-booking.netlify.app, branch-deploy on, gałąź domyślna = robocza.
  Branch `claude/trip-room-registration-YDP2c`. Commity: `noreply@anthropic.com` / `Claude`
  + trailery `Co-Authored-By: Claude Opus 4.8` i `Claude-Session`. Ostatni push `ff36373`
  (kod zamian `520da51`).

## Migracje
`0001`–`0012` nałożone i zweryfikowane przeze mnie. **`0013_swap_requests.sql`** (zamiany:
`pairing_requests.kind` `pair|swap|invite`, status `completed`, `send_swap_request`,
`respond_pairing_request` rozgałęziony po kind — swap na accept atomowo zamienia pokoje,
blokada przy locku) — **nałożone przez użytkownika w innym czacie; treść niezweryfikowana;
podejrzenie regresji `create_trip`**.

## Zrealizowane (na żywo)
Fazy 1–9 (onboarding, reguły, korekty organizatora, auth-kod organizatora, optimize.ts,
tworzenie wyjazdu/pokojów z UI, usuwanie wyjazdu, testy współbieżności, PWA+mobile-first,
i18n EN/PL, solver `solve.ts` + `admin_set_assignments`, requesty negocjowane/pary),
wsadowe dodawanie pokojów, panel propozycji na górze (`ProposalsBar`), pokoje
zielony/żółty/czerwony. **v2 fundament kont (additywnie, nieblokująco):** `0012`,
`src/lib/auth.ts`, `src/auth/AuthProvider.tsx`, `src/components/AuthLanding.tsx`, Sign in/up
w nagłówku (konto NIE napędza jeszcze tożsamości/własności — cutover odłożony).

## Zadania / plan
- **Nirvana:** zadanie **#3 „Rooms Booking: preferencje per-pokój"** — stan **someday**, tag
  `rooms-booking`, id `019fe872-1582-7114-a100-7f14199ca47c`.
- **Plik planu** `/root/.claude/plans/dawaj-solver-...jellyfish.md` = plan SOLVERA (zrobiony,
  nieaktualny). Planu v2/auth brak w pliku.
- **v2 UX:** #1 zamiany (kod gotowy, migracja nałożona, do weryfikacji po fixie), #2
  zaproszenia do pokoju (następne; `kind='invite'` zarezerwowane), #3 per-pokój (Nirvana).
- **Decyzje v2:** e-mail+hasło, rejestracja bez potwierdzania mailem, reset wbudowanym
  mailem; Google SSO faza 2; fazami; per-pokój = preferowane/unikane pokoje. Cutover auth
  wymaga w panelu Supabase: wyłączyć „Confirm email" + ustawić Site URL.

## Następne kroki (kolejność)
1. **Napraw `create_trip`** (blokuje tworzenie wyjazdów): dostęp do bazy → `get_logs` /
   uruchom `create_trip` → zobacz błąd → napraw (najpewniej `search_path`), sprawdź pustą
   listę wyjazdów. Zweryfikuj. **→ potem USUŃ ten plik.**
2. Zweryfikuj **#1 (zamiany)** end-to-end na żywo.
3. Zbuduj **#2 (zaproszenia do pokoju)** — `send_room_invite` + `kind='invite'` w
   `respond_pairing_request` (na accept: przenieś zapraszanego jeśli miejsce i brak locka),
   UI `PairingsPanel`+`ProposalsBar`, i18n, testy.
4. Później: cutover auth na `auth.uid()` (po toggle'ach w panelu), #3 per-pokój.

**Wzorce:** RPC `security definer` / `set search_path=public` (+`extensions` gdy pgcrypto),
`perform assert_organizer(...)`, invarianty na serwerze; `npm run typecheck && lint && test
&& build`; adversarialny review workflow po większych featurach; commit lokalnie gdy MCP
down, push gdy grozi reset kontenera; deploy potwierdzać Netlify MCP (`commit_ref` + `ready`).
