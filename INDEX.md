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
├── CLAUDE.md            # założenia techniczne + zasady dla asystenta
├── NEEDS.md             # wymagania krytyczne
├── DIRECTION.md         # wizja i dodatki
├── INDEX.md             # ten plik — mapa + zasady pracy
├── README.md            # setup i deploy (Supabase + Netlify, free)
├── package.json         # zależności i skrypty (dev/build/lint/test)
├── netlify.toml         # konfiguracja hostingu Netlify (free)
├── .env.example         # wzór zmiennych środowiskowych Supabase
├── supabase/
│   ├── migrations/
│   │   └── 0001_init.sql # schemat + invarianty + RPC (atomowość, lock) + RLS + realtime
│   └── seed.sql          # dane demo do testów
├── src/
│   ├── main.tsx          # bootstrap React
│   ├── App.tsx           # layout + zakładki: uczestnik / organizator
│   ├── i18n/strings.ts   # CAŁY tekst UI (angielski; PL jako przyszły słownik)
│   ├── types/domain.ts   # typy domenowe (lustro schematu DB)
│   ├── lib/supabase.ts   # klient Supabase (czyta .env)
│   ├── lib/actions.ts    # wywołania RPC (join/leave/lock) + mapowanie błędów
│   ├── lib/rules.ts      # czysta ocena reguł MUST HAVE vs preferencja + status koloru
│   ├── lib/rules.test.ts # testy jednostkowe logiki reguł (Vitest)
│   ├── hooks/useTripData.ts     # ładowanie danych + subskrypcja realtime
│   ├── pages/ParticipantView.tsx    # widok uczestnika (zapis/wypis/przepis)
│   └── pages/OrganizerDashboard.tsx # dashboard: liczniki, kolor, lock, naruszenia
└── .claude/             # hook SessionStart (instalacja zależności w sesjach web)
```

### Kluczowe obszary kodu i ich funkcje
- **Model domenowy** (`src/types/domain.ts`, `supabase/migrations`) — Wyjazd, Pokój,
  Uczestnik, Przypisanie, Reguła (preferencja/MUST HAVE).
- **Logika zapisów** (`supabase/migrations/0001_init.sql` → `join_room`/`leave_room`) —
  atomowy zapis/przepisanie/wypisanie z gwarancją invariantów, odporny na wyścig
  (blokada wiersza pokoju + `UNIQUE`) — `NEEDS.md §10`.
- **Realtime** (`src/hooks/useTripData.ts`) — podgląd na żywo obłożenia pokojów.
- **Silnik reguł** (`src/lib/rules.ts`) — wykrywanie naruszeń MUST HAVE (krytyczne)
  vs niespełnionych preferencji (informacyjne). Optymalizacja na żądanie (`NEEDS.md §9`)
  — jeszcze niezaimplementowana (kolejny krok).
- **Dashboard organizatora** (`src/pages/OrganizerDashboard.tsx`) — liczniki,
  sygnalizacja kolorem, lock. Ręczne korekty — kolejny krok.

---

## 4. Konwencja statusu zadań
W `NEEDS.md` checkboxy `- [ ]` / `- [x]` oznaczają stan realizacji wymagań.
Zaznaczaj `- [x]` dopiero, gdy dana potrzeba jest **zaimplementowana i działa**.
