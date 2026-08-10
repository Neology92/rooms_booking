# CLAUDE.md — Założenia techniczne projektu

Aplikacja do **rejestracji uczestników do pokojów na wyjeździe grupowym**.

> 📌 **Zacznij od [`INDEX.md`](./INDEX.md)** — opisuje strukturę projektu, kluczowe pliki
> i **zasady pracy** (w tym jak korzystać z `NEEDS.md`).
>
> Hierarchia dokumentów:
> - [`NEEDS.md`](./NEEDS.md) — wymagania **krytyczne** (wiążące).
> - [`DIRECTION.md`](./DIRECTION.md) — wizja i dodatki (aspiracyjne).
> - [`INDEX.md`](./INDEX.md) — mapa repo + zasady pracy.
> - `CLAUDE.md` (ten plik) — architektura, stack, konwencje, invarianty techniczne.

---

## 0. Zasada nadrzędna dla asystenta
Każda decyzja techniczna ma być **zakotwiczona w `NEEDS.md`**. Przed kodowaniem
sprawdź zgodność, wskaż realizowaną potrzebę, a niezgodności (zwłaszcza naruszenie
**invariantów `NEEDS.md §10`**) zgłaszaj **wprost**. Nowe potrzeby → proponuj dopisanie
do `NEEDS.md` (krytyczne) lub `DIRECTION.md` (dodatki). Szczegóły: [`INDEX.md §2`](./INDEX.md).

---

## 1. Status i charakter projektu
- Faza: **założenia / start**. Stack nie jest jeszcze zaimplementowany.
- Charakter: aplikacja **webowa**, responsywna (uczestnik najczęściej na telefonie,
  organizator na desktopie).
- Sekcje oznaczone *(propozycja)* wymagają potwierdzenia przez autora przed wdrożeniem.

---

## 2. Kluczowe wymagania techniczne (wynikają z `NEEDS.md`)
Architektura **musi** obsłużyć:
- **Współbieżność** — wielu uczestników zapisuje się równocześnie. Egzekwowanie limitu
  miejsc i „jeden pokój na osobę” musi być **atomowe** (transakcja / blokada / `UNIQUE`),
  odporne na wyścig o ostatnie miejsce. *(NEEDS §4, §10)*
- **Operacja przepisania = atomowy „wypisz z A + zapisz do B”** (bez stanu pośredniego
  z podwójnym członkostwem). *(NEEDS §4)*
- **Realtime** — podgląd obłożenia pokojów na żywo (subskrypcje / websockety). *(NEEDS §4, §5)*
- **Lock zapisów** — globalny przełącznik blokujący zmiany po stronie uczestnika,
  egzekwowany **po stronie serwera**, nie tylko w UI. *(NEEDS §3)*
- **Rozróżnienie reguł** twarde (MUST HAVE) vs miękkie (preferencja) jako pole w modelu,
  napędzające walidację i sygnalizację. *(NEEDS §7, §8)*

---

## 3. Model domenowy (szkic)
Encje (nazwy robocze):
- **Trip (Wyjazd)** — `id`, `name`, `target_headcount`, `signups_locked` (bool).
- **Room (Pokój)** — `id`, `trip_id`, `name`, `capacity`, `info` (np. kod/lokalizacja).
- **Participant (Uczestnik)** — `id`, `trip_id`, `name`, `email`, `gender`.
- **Assignment (Przypisanie)** — `id`, `trip_id`, `participant_id` **(UNIQUE — jeden pokój
  na osobę)**, `room_id`. Brak rekordu = niezapisany.
- **Rule (Reguła)** — `id`, `participant_id`, `type` (`same_gender` | `preferred_person` | …),
  `strictness` (`must_have` | `preference`), `target_participant_id?`.
- *(opcjonalnie, DIRECTION)* **PreferenceRequest** — `from`, `to`, `status`.

Invarianty egzekwowane na poziomie danych/serwera — patrz `NEEDS.md §10`.

---

## 4. Stack — darmowy z założenia (`NEEDS §11` — ZERO kosztów)
Cel: jak najmniej infrastruktury, realtime + atomowość + auth, a przy tym **100% w ramach
darmowych planów**. Brak kosztów to **wymaganie twarde** — nie wolno go naruszać dla
spełnienia innych wymagań krytycznych.

- **Frontend + domena:** **Netlify** (Free) — hosting statycznego frontendu +
  **darmowa domena** `*.netlify.app`. Frontend: React + TypeScript.
- **Backend + dane:** **Supabase** (Free) — PostgreSQL + Realtime + Auth + Row Level
  Security. Postgres daje transakcje i ograniczenia (`UNIQUE`, `CHECK`) potrzebne do
  egzekwowania invariantów (`NEEDS §10`).
- **Egzekwowanie limitu/locka:** w transakcji DB lub funkcji serwerowej (RPC),
  **nigdy** wyłącznie w kliencie.
- **Optymalizacja (`NEEDS §9`):** start od prostej heurystyki wykrywania naruszeń
  i propozycji zamian; docelowo ew. solver (patrz `DIRECTION.md §3`).

### 4.1. Limity darmowych planów (świadomość kosztów)
Dla aplikacji na wyjazd grupowy darmowe plany wystarczają z dużym zapasem. Pilnuj:
- **Supabase Free:** 500 MB bazy, 50 tys. MAU, **200 jednoczesnych połączeń realtime**
  (najwęższe gardło — liczy się ruch *równoczesny*, nie łączny), usypianie projektu
  po 7 dniach bezczynności, 2 projekty.
- **Netlify Free:** 100 GB transferu, 300 min buildów; po limicie strona jest
  wstrzymywana (twardy limit, **brak niespodziewanych rachunków**).
- Gdyby któreś wymaganie groziło wyjściem poza free → **zgłoś to** i przenieś dyskusję
  o płatnych planach do `DIRECTION.md`. Nie wprowadzaj płatnego planu po cichu.

> Alternatywy (Firebase, Neon + Next.js itp.) dopuszczalne **tylko** jeśli pozostają
> w pełni darmowe i spełniają §2. Każdą zmianę stacku odnotuj tutaj.

---

## 5. Konwencje (do uzupełniania w miarę rozwoju)
- **Język:** **UI aplikacji po angielsku** (MUST HAVE — `NEEDS §12`); polski w UI to
  przyszły dodatek (`DIRECTION.md`). Dokumentacja założeń po polsku; nazwy w kodzie po angielsku.
  Teksty UI trzymaj w jednym miejscu (np. słownik i18n), by późniejszy PL był łatwy.
- **Walidacja invariantów:** zawsze po stronie serwera; UI tylko wspiera UX.
- **Sygnalizacja w dashboardzie:** kolor wprost odwzorowuje stan
  (np. zielony=komplet/OK, żółty=w toku, czerwony=naruszony MUST HAVE / przekroczenie).
- **MUST HAVE w UX:** domyślnie reguła jest preferencją; oznaczenie „wymagane” wymaga
  świadomego działania i bywa zniechęcane copy-em. *(NEEDS §7.1)*
- **Testy:** krytyczne ścieżki (limit, brak dublowania, lock) powinny mieć testy
  na wyścigi/współbieżność.
- **Po dodaniu realnej struktury kodu — zaktualizuj tabelę w [`INDEX.md §3`](./INDEX.md).**

---

## 6. Komendy projektu
- `npm install` — instalacja zależności.
- `npm run dev` — lokalny serwer deweloperski (Vite).
- `npm run build` — typecheck + build produkcyjny do `dist/`.
- `npm run typecheck` — sama kontrola typów.
- `npm run lint` — ESLint.
- `npm test` — testy jednostkowe (Vitest).

Baza: w panelu Supabase uruchom `supabase/migrations/0001_init.sql`
(i opcjonalnie `supabase/seed.sql`). Konfiguracja połączenia: `.env` wg `.env.example`.
Setup i deploy: patrz `README.md`.

## 7. Stan implementacji (MVP) i kolejne kroki
Zrobione: lista pokojów + obłożenie na żywo, atomowy zapis/przepisanie/wypisanie
(bez dublowania, odporne na wyścig o ostatnie miejsce), lock egzekwowany po stronie
serwera, dashboard organizatora (liczniki, status kolorem, sygnalizacja MUST HAVE vs
preferencja).

Doszło: onboarding uczestnika (imię/e-mail/płeć), reguły uczestnika (same-gender /
preferowana osoba, twarde vs miękkie), **ręczne korekty organizatora** (`admin_assign` /
`admin_unassign` — override przypisań w dashboardzie, omija lock, ale pilnuje
pojemności i „jeden pokój na osobę").

Faza 4 — **autoryzacja organizatora** (`0005`): każdy wyjazd ma kod organizatora
(bcrypt via pgcrypto); pierwszy ustawiający kod „przejmuje" wyjazd. RPC-y organizatora
(`set_signups_lock`, `admin_assign`, `admin_unassign`, `admin_swap`) weryfikują kod
przez `assert_organizer` — egzekwowanie po stronie serwera (`NEEDS §10.3`). Uczestnicy
pozostają bez kont. Hash kodu nigdy nie trafia do klienta.

Faza 5 — **optymalizacja na żądanie** (`NEEDS §9`, `0006`): czysta heurystyka
(`src/lib/optimize.ts`, testy jednostkowe) proponuje **zamiany** pokojów — najpierw
naprawia MUST HAVE, potem preferencje; zamiana zachowuje limity pokojów. Zastosowanie
propozycji przez atomowe `admin_swap`.

Faza 6 — **tworzenie wyjazdu i pokojów z UI** (`NEEDS §2/§3`, `0007`): `create_trip`
(tworzy i od razu przejmuje wyjazd kodem), CRUD pokojów (`admin_create_room` /
`admin_update_room` / `admin_delete_room`) i `admin_set_target` — wszystko
organizator-only, z pilnowaniem invariantów (pojemność ≥ obłożenie, pokój z ludźmi
nieusuwalny). Wybór wyjazdu przez `?trip=<id>` w URL (shareable), landing = picker
z listą wyjazdów i formularzem tworzenia. Migracja `0008` naprawia search_path
funkcji pgcrypto (na Supabase `crypt`/`gen_salt` żyją w schemacie `extensions`).

Faza 7 — **dopięcia**: usuwanie wyjazdu z UI (`admin_delete_trip`, `0009`, cascade,
organizator-only), **testy współbieżności** (integracyjne, przeciw realnemu Postgresowi:
limit/dublowanie/lock — `src/lib/concurrency.integration.test.ts`, `npm run test:integration`),
**PWA** (instalowalna, service worker via `vite-plugin-pwa`, manifest, ikona) i **mobile-first**
(cele dotykowe ≥44px, inputy 16px, safe-area). **Polski locale** — provider i18n
(`src/i18n/I18nProvider.tsx`) + słownik `pl`, przełącznik EN/PL; domyślnie EN (`NEEDS §12`).

Faza 8 — **requesty negocjowane** (`DIRECTION.md`, `0010`): `pairing_requests`
(send/accept/withdraw/end, trust-based; partial-unique index na nieuporządkowanej
parze + advisory lock w `send` → jedna aktywna para na dwójkę). Zaakceptowana para =
dwie **syntetyczne miękkie** preferencje wpuszczane przez `effectiveRules` w
sygnalizację i optymalizator — `unmetRules`/`optimize` bez zmian, `rules`/`assignments`
nietknięte (§10 bezpieczne). Projekt i review przez multi-agent workflow (panel
projektowy + adversarialna weryfikacja diffu).

Faza 9 — **solver** (`DIRECTION.md`, `NEEDS §9`, `0011`): `src/lib/solve.ts` — symulowane
wyżarzanie + restarty + zachłanny polish (seedowany `mulberry32`, deterministyczny),
ruchy = zamiany **oraz** relokacje w wolne miejsca (przełamuje „ścianę osiągalności"
swap-only — naprawia MUST-HAVE rozwiązywalne tylko przeniesieniem na wolne łóżko).
Dynamiczna waga `W=(#preferencji)+1` (MUST-HAVE first), keep-best → **nigdy gorzej**.
Zakres: tylko przestawianie zapisanych. Atomowy apply pełnego planu przez
`admin_set_assignments(uuid[],uuid[])` z kontraktem pełnego zbioru (odporność na wyścig),
capacity/one-room po stronie serwera. `optimize.ts` zostaje jako lżejsza heurystyka.
Projekt (panel 3 podejść + sędzia) i review (0 znalezisk) przez multi-agent workflow.

Faza 10 — **konta użytkowników** (`DIRECTION.md`, `0012`): Supabase Auth (e-mail/hasło),
`AuthProvider` + `useAuth` hook, formularz logowania/rejestracji, guard na stronach.
Konta są niezależne od uczestników wyjazdu (równoległe ścieżki: uczestnik = trust-based
imię, konto = opcjonalne). Rollout note w UI. Migracja `0012` dodaje RLS + tabele auth.

Faza 11 — **propozycje zamiany** (`DIRECTION.md`, `0013`): uczestnik w pokoju może
zaproponować zamianę pokojów z kimś w innym pokoju. Nowy `kind='swap'` +
`status='completed'` w `pairing_requests`. `send_swap_request` waliduje różne pokoje;
`respond_pairing_request` na accept atomowo wymienia pokoje obu stron i ustawia
`completed` (nie `accepted` — zamiana nie generuje syntetycznej preferencji).
Zablokowane przy `signups_locked`. UI: sekcja swap w `PairingsPanel`, wyświetlanie
w `ProposalsBar`. Testy integracyjne (`swap.integration.test.ts`).

Faza 12 — **zaproszenia do pokoju** (`DIRECTION.md`, `0014`): uczestnik w pokoju może
zaprosić kogoś do dołączenia. `send_room_invite` — zapraszający musi być w pokoju,
zapraszany w tym samym wyjeździe (może być bez pokoju lub w innym).
`respond_pairing_request` na accept: sprawdza lock, znajduje aktualny pokój
zapraszającego, blokuje wiersz pokoju (FOR UPDATE), sprawdza pojemność, przenosi
zapraszanego (INSERT ON CONFLICT). Status → `completed`. Pojemność i lock
egzekwowane po stronie serwera (§10.2, §10.3). UI: sekcja invite w `PairingsPanel`,
wyświetlanie w `ProposalsBar`, i18n EN+PL. Testy integracyjne
(`invite.integration.test.ts`): happy path, unassigned, room full, lock, same room,
inviter not assigned, decline.

Faza 13 — **audyt UX + solvera i naprawy**: dwa niezależne audyty (UX flow uczestnika,
kompletność solvera) potwierdziły poprawność solvera i znalazły 5 bugów — wszystkie
naprawione: (1) zapytanie o `rules` w `useTripData` nieograniczone do wyjazdu (wyciek
między wyjazdami; fix: inner-join embed przez `participants.trip_id` — `rules` nie ma
kolumny `trip_id`), (2) `describe()` w dashboardzie po angielsku w trybie PL
(→ `describeIssue` + i18n), (3) brak stylu `banner--pref`, (4) nierenderowane
`viewOnly`, (5) nierenderowane nagłówki swap/invite. Do tego: panel problemów nad
strefą niebezpieczną, tagi rodzaju + linia konsekwencji w `ProposalsBar` („Akceptacja
przenosi Cię do pokoju X" — swap/invite działają od razu, pair to tylko preferencja),
+6 testów luk (gender `other`, same-gender jako preferencja, solver bez reguł /
1 osoba / syntetyczne reguły z pairingów), koszt fuzz testu wyrównany do formuły solvera.

Faza 14 — **maile: Resend przez Edge Function** (`DIRECTION §1`): funkcja
`supabase/functions/send-room-emails` — organizator (kod weryfikowany server-side
przez `verify_organizer`) rozsyła uczestnikom z e-mailem ich pokój (Resend batch API,
1 call na blast; 40 osób ≪ 100 maili/dzień free). Wymagane sekrety w Supabase:
`RESEND_API_KEY`, opcjonalnie `MAIL_FROM` (bez zweryfikowanej domeny Resend wysyła
tylko na adres właściciela konta — tryb testowy). UI: sekcja „Maile do uczestników"
w dashboardzie (confirm z liczbą odbiorców, wynik wysyłki, i18n EN+PL, mapowanie
błędów `MAIL_NOT_CONFIGURED`/`SEND_FAILED`/`NOT_ORGANIZER`).

Kolejne kroki (świadomie odłożone, zgodne z `NEEDS`/`DIRECTION`):
- **Pełne konta użytkowników / per-user auth** — `DIRECTION.md`.
