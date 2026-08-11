# INDEX.md — Mapa projektu i zasady pracy

Ten plik opisuje **strukturę projektu**, **kluczowe pliki i ich funkcje** oraz
**jak pracować z dokumentami założeń**. Jest linkowany z [`CLAUDE.md`](./CLAUDE.md)
i ma być pierwszym przystankiem przy orientacji w repozytorium.

---

## 1. Dokumenty założeń (czytaj najpierw)

| Plik | Funkcja | Charakter |
|------|---------|-----------|
| [`NEEDS.md`](./NEEDS.md) | Potrzeby, zakres i **wymagania krytyczne**. Co aplikacja **musi** robić. | Wiążące — utrzymywane |
| [`DIRECTION.md`](./DIRECTION.md) | Wizja i **„fajne dodatki”**. Kierunek, do którego dążymy. | Niewiążące — aspiracyjne |
| [`CLAUDE.md`](./CLAUDE.md) | Założenia **techniczne**: architektura, stack, konwencje, invarianty. | Wiążące — utrzymywane |
| [`INDEX.md`](./INDEX.md) | Ten plik — mapa repo + zasady pracy. | Pomocnicze |

### 1.1. Gdzie co żyje (jedno źródło prawdy)
Każda informacja ma **jedno** miejsce. Reszta plików **linkuje**, nie kopiuje —
inaczej wersje się rozjeżdżają i nie wiadomo, której wierzyć.

| Informacja | Jedyne źródło |
|------------|---------------|
| Czy wymaganie krytyczne jest spełnione | `NEEDS.md` (checkboxy) |
| Co już zbudowano, faza po fazie | `CLAUDE.md §7` |
| Co zostało do zrobienia / dług techniczny | `CLAUDE.md §8` |
| Pomysły „na potem” i ich status | `DIRECTION.md` |
| Architektura, invarianty, konwencje | `CLAUDE.md §2–§5` |
| Setup, konfiguracja poczty, deploy | `README.md` |
| Komendy (`npm run …`) | `package.json` (dokumenty tylko streszczają) |
| Mapa plików i katalogów | `INDEX.md §3` (ten plik) |
| Cały tekst UI | `src/i18n/strings.ts` |

---

## 2. Jak korzystać z `NEEDS.md` (zasada pracy — obowiązuje też Claude'a)

`NEEDS.md` to **źródło prawdy** o tym, czego oczekują autor i użytkownicy.
Przy **każdym** zadaniu (planowanie, kod, refaktor, decyzja projektowa):

1. **Wracaj do potrzeb** — zanim zaproponujesz rozwiązanie, sprawdź, czy jest
   zgodne z `NEEDS.md` (a dla aspiracji — z `DIRECTION.md`).
2. **Wskazuj zgodność** — pokazuj, którą potrzebę realizuje dana zmiana
   (np. „realizuje NEEDS §4 — brak dublowania zapisów”).
3. **Sygnalizuj niezgodności** — jeśli prośba lub kod **łamie** założenie z `NEEDS.md`
   (zwłaszcza **invarianty z §10**), **zatrzymaj się i powiedz to wprost**,
   zamiast po cichu obejść regułę.
4. **Proponuj zmiany w założeniach** — gdy w trakcie promptowania pojawia się
   nowa potrzeba lub sprzeczność:
   - jeśli to wymaganie kluczowe → zaproponuj **dopisanie/zmianę w `NEEDS.md`**,
   - jeśli to „miłe, ale niekonieczne” → zaproponuj **dopisanie do `DIRECTION.md`**.
   Nie zmieniaj zakresu po cichu — **najpierw zaproponuj aktualizację dokumentu**.
5. **Utrzymuj spójność** — gdy kod i dokument się rozjeżdżają, zgłoś to i
   doprowadź do zgody (albo kod do założeń, albo zaktualizuj założenia świadomie).

> TL;DR: każda decyzja ma być **identyfikowalnie zakotwiczona** w `NEEDS.md`
> (lub świadomie i jawnie poza nim).

---

## 3. Struktura projektu

> Aktualizuj tę tabelę, gdy struktura się zmienia (MVP już istnieje).

```
rooms_booking/
├── CLAUDE.md / NEEDS.md / DIRECTION.md / INDEX.md   # dokumenty założeń (tabela §1)
├── README.md            # setup, konfiguracja poczty i deploy (Supabase + Netlify)
├── package.json         # zależności i skrypty — ŹRÓDŁO PRAWDY dla komend
├── netlify.toml         # hosting Netlify (free)
├── .env.example         # wzór zmiennych środowiskowych Supabase
├── supabase/
│   ├── migrations/      # 0001…0014, uruchamiane po kolei (opis niżej)
│   ├── functions/
│   │   └── send-room-emails/  # Edge Function: mailing przydziałów (Resend)
│   └── seed.sql         # dane demo do testów
├── src/
│   ├── main.tsx / App.tsx     # bootstrap + layout, zakładki uczestnik/organizator
│   ├── i18n/                  # strings.ts (CAŁY tekst UI, EN+PL) + I18nProvider
│   ├── types/domain.ts        # typy domenowe (lustro schematu DB)
│   ├── auth/AuthProvider.tsx  # sesja Supabase Auth (konta, faza 10)
│   ├── lib/
│   │   ├── supabase.ts        # klient Supabase (czyta .env)
│   │   ├── auth.ts            # logowanie/rejestracja/reset hasła
│   │   ├── actions.ts         # WSZYSTKIE wywołania RPC + mapowanie błędów na i18n
│   │   ├── rules.ts           # ocena reguł MUST HAVE vs preferencja + status koloru
│   │   ├── solve.ts           # solver (symulowane wyżarzanie) — używany w UI
│   │   ├── optimize.ts        # starsza heurystyka swap-only (patrz uwaga niżej)
│   │   └── *.test.ts          # jednostkowe; *.integration.test.ts — przeciw realnej bazie
│   ├── hooks/                 # useTripData (dane+realtime), useIdentity, useOrganizer, useTripId
│   ├── components/            # Onboarding, TripPicker, RoomsEditor, RulesEditor,
│   │                          # PairingsPanel, ProposalsBar, OrganizerAuth, AuthLanding
│   └── pages/                 # ParticipantView, OrganizerDashboard
└── .claude/             # hook SessionStart (instalacja zależności w sesjach web)
```

### Migracje — co wnosi która
`0001` schemat + invarianty + `join_room`/`leave_room` + RLS + realtime ·
`0002` onboarding uczestnika · `0003` reguły · `0004` korekty organizatora ·
`0005` autoryzacja organizatora (bcrypt) · `0006` `admin_swap` ·
`0007` tworzenie wyjazdu i pokojów · `0008` fix `search_path` pgcrypto ·
`0009` usuwanie wyjazdu · `0010` `pairing_requests` · `0011` `admin_set_assignments` ·
`0012` fundament kont · `0013` propozycje zamiany · `0014` zaproszenia do pokoju.

### Kluczowe obszary kodu i ich funkcje
- **Model domenowy** (`src/types/domain.ts`, `supabase/migrations`) — Wyjazd, Pokój,
  Uczestnik, Przypisanie, Reguła, Prośba (`pairing_requests`: pair/swap/invite).
- **Logika zapisów** (`0001` → `join_room`/`leave_room`) — atomowy zapis/przepisanie/
  wypisanie, odporne na wyścig (blokada wiersza + `UNIQUE`) — `NEEDS.md §10`.
- **Realtime** (`src/hooks/useTripData.ts`) — podgląd na żywo obłożenia pokojów.
- **Silnik reguł** (`src/lib/rules.ts`) — naruszenia MUST HAVE (krytyczne) vs
  niespełnione preferencje; `effectiveRules` dokłada syntetyczne miękkie preferencje
  z zaakceptowanych par.
- **Optymalizacja** (`NEEDS.md §9`) — `src/lib/solve.ts` (solver używany w UI).
  `optimize.ts` to wcześniejsza heurystyka swap-only: **nieużywana w UI**, trzymana
  jako punkt odniesienia w testach (dowodzi, że sama zamiana nie rozwiąże MUST-HAVE
  wymagającego wolnego łóżka) — patrz `CLAUDE.md §8.6`.
- **Dashboard organizatora** (`src/pages/OrganizerDashboard.tsx`) — liczniki,
  sygnalizacja kolorem, lock, ręczne korekty, solver, mailing.

> Stan wdrożeń i dług techniczny **nie są duplikowane w tym pliku** —
> żyją w [`CLAUDE.md §7`](./CLAUDE.md) (co zrobiono) i [`CLAUDE.md §8`](./CLAUDE.md) (co zostało).

---

## 4. Konwencja statusu zadań
W `NEEDS.md` checkboxy `- [ ]` / `- [x]` oznaczają stan realizacji wymagań.
Zaznaczaj `- [x]` dopiero, gdy dana potrzeba jest **zaimplementowana i działa**.
Obecnie **wszystkie** wymagania krytyczne są odhaczone — nowe wymaganie dopisuj
jako `- [ ]` i odhaczaj przy wdrożeniu.

W `DIRECTION.md`: ✅ zrobione · 🔧 zrobione, wymaga dokończenia · bez znacznika = pomysł.

Rzeczy **do zrobienia w kodzie** (bugi, dług, braki) nie żyją w komentarzach `TODO:`
rozsianych po plikach, tylko w `CLAUDE.md §8` — jednej liście z podziałem na kategorie.
