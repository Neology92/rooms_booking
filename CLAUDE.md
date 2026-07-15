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

Kolejne kroki (świadomie odłożone, zgodne z `NEEDS`/`DIRECTION`):
- **Auth + autoryzacja organizatora** — obecnie RPC (`set_signups_lock`, `admin_assign`,
  `admin_unassign`, `register_participant`, `set_rule`) nie są ograniczone do organizatora
  (RLS tylko do odczytu, zapisy przez SECURITY DEFINER bez ról). To **dług do spłaty**
  zanim aplikacja pójdzie publicznie.
- **Optymalizacja na żądanie** (`NEEDS §9`) — propozycje zamian.
- **Wysyłka e-maili**, **polski locale**, **requesty preferencji** — `DIRECTION.md`.
