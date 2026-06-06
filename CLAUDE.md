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

## 4. Proponowany stack *(propozycja — do potwierdzenia)*
Cel: jak najmniej infrastruktury, a jednocześnie realtime + atomowość + auth.

- **Frontend:** React + TypeScript (lub Next.js). UI komponentowy, responsywny.
- **Backend + dane:** **Supabase** (PostgreSQL + Realtime + Auth + Row Level Security)
  **lub** Next.js full-stack z Postgres. Postgres daje transakcje i ograniczenia
  (`UNIQUE`, `CHECK`) potrzebne do egzekwowania invariantów.
- **Egzekwowanie limitu/locka:** w transakcji DB lub funkcji serwerowej (RPC),
  **nigdy** wyłącznie w kliencie.
- **Optymalizacja (`NEEDS §9`):** start od prostej heurystyki wykrywania naruszeń
  i propozycji zamian; docelowo ew. solver (patrz `DIRECTION.md §3`).

> Alternatywy (Firebase, własny Node/Express + Postgres) są dopuszczalne, jeśli
> spełniają wymagania z §2. Decyzję o stacku potwierdź z autorem i odnotuj tutaj.

---

## 5. Konwencje (do uzupełniania w miarę rozwoju)
- **Język:** dokumentacja założeń po polsku; nazwy w kodzie po angielsku.
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
*(Brak — projekt jeszcze nie ma kodu. Uzupełnij po inicjalizacji: instalacja, dev, build, test.)*
