# DIRECTION.md — Wizja i „fajne dodatki”

> **Status dokumentu:** kierunek, w którym **może** zmierzać aplikacja.
> To **nie są** wymagania krytyczne — mogą nigdy nie powstać i to jest OK.
> Wymagania, które *muszą* być spełnione, są w [`NEEDS.md`](./NEEDS.md).
> Ten plik nadaje ogólną wizję i porządkuje pomysły „na potem”.
>
> **Legenda:** ✅ = już zrobione (szczegóły w [`CLAUDE.md §7`](./CLAUDE.md)) ·
> 🔧 = zrobione, ale wymaga dokończenia ([`CLAUDE.md §8`](./CLAUDE.md)) ·
> bez znacznika = wciąż tylko pomysł.

---

## 1. Komunikacja i automatyzacja
- 🔧 **Automatyczne rozsyłanie maili** do uczestników: kody do pokojów, lokalizacje.
  Wysyłka przydziałów na żądanie organizatora **działa** (Resend + Edge Function),
  ale wymaga dokończenia konfiguracji — `CLAUDE.md §8.1`. Przypomnienia i info
  o zbliżającym się zamknięciu zapisów — wciąż pomysł.
  *(Samo zbieranie e-maili jest w NEEDS.md; automatyczny mailing to dodatek.)*
- Powiadomienia push / w aplikacji o zmianach w „moim” pokoju.
- Eksport listy pokojów (CSV/Excel/PDF) dla recepcji hotelu.

## 2. Preferencje jako negocjacja społeczna
- ✅ **Requesty preferencji** między uczestnikami: osoba A wysyła prośbę „chcę z Tobą”,
  osoba B akceptuje → preferencja staje się **dwustronna i potwierdzona**.
  *(W NEEDS.md zostaje prostsze: ręczne wzajemne wpisanie się.)*
- ✅ Status preferencji: oczekująca / wzajemna / odrzucona (+ wycofana, zakończona).
- „Grupy znajomych” — definiowanie paczki osób, które chcą trzymać się razem.

## 3. Zaawansowana optymalizacja przydziału
- ✅ Pełny **solver** maksymalizujący spełnienie preferencji przy twardych ograniczeniach
  (limity, MUST HAVE, płeć) — symulowane wyżarzanie, `src/lib/solve.ts`.
- ✅ **Propozycje wymian negocjowane między uczestnikami**: uczestnik proponuje zamianę
  lub zaproszenie do pokoju, druga strona zatwierdza w aplikacji.
- „Symulacja” — organizator widzi *przed* zastosowaniem, jak zmienią się wskaźniki
  spełnienia preferencji.
- Scoring jakości całego przydziału (np. % spełnionych preferencji).

## 4. Bogatsze reguły i profile uczestników
- Dodatkowe kryteria dopasowania: chrapanie, godzina snu, palenie, cisza/impreza,
  zakres wieku, znajomość języka.
- Profile uczestników z krótkim „opisem współlokatora”.
- „Czarne listy” (z kim na pewno nie chcę).

## 5. Wielowydarzeniowość i organizacja
- ✅ Obsługa **wielu wyjazdów** jednocześnie (picker + `?trip=<id>`); archiwum — pomysł.
- Wielu współorganizatorów z różnymi uprawnieniami.
- Szablony pokojów (powielanie układu z poprzedniego wyjazdu).
- Historia zmian / audit log „kto, kiedy, co zmienił”.

## 6. UX i dostępność
- ✅ Wersja mobilna / **PWA** (instalowalna, service worker). Offline-first — pomysł.
- ✅ Link do dołączenia do wyjazdu bez zakładania konta (`?trip=<id>`); QR — pomysł.
- ✅ **Polska wersja językowa UI** — przełącznik EN/PL, domyślnie EN (`NEEDS §12`).
  Kolejne języki: dopisz słownik w `src/i18n/strings.ts`.
- Widok „mapa pokojów” / wizualny układ pięter.

---

## 7. Integracje deweloperskie / AI (np. Claude Code)
Wpięcie automatyzacji i asystentów AI w cykl pracy nad projektem oraz w samą aplikację:
- ✅ **Claude Code w repo** — `CLAUDE.md` jako kontekst, hook SessionStart instalujący
  zależności. Uruchamianie testów/linterów z hooka i automatyczny przegląd PR-ów — pomysł.
- ✅ **Claude Code on the web / GitHub** — zlecanie zmian i przeglądów z poziomu repo.
- **AI w produkcie** — np. asystent sugerujący przydział pokojów w języku naturalnym
  („posadź te 3 osoby razem, resztę dobierz wg preferencji”) jako nakładka na silnik z `NEEDS §9`.
- Webhooki / API, by spinać aplikację z zewnętrznymi narzędziami (kalendarz, mail, Slack).

> Wszystkie powyższe to **dodatki** — nie mogą naruszać wymagania `NEEDS §11` (ZERO kosztów)
> dla funkcji krytycznych. Jeśli integracja generuje koszt, jest opcjonalna i świadomie włączana.

---

## 8. Benchmark — istniejące rozwiązania (inspiracje, nie wymagania)
Rynek ma częściowe odpowiedniki — warto się nimi inspirować, ale żaden nie pokrywa
dokładnie tej kombinacji (samodzielne zapisy na żywo + twarde/miękkie reguły + lock +
optymalizacja na żądanie dla nieformalnej grupy wyjazdowej):

- **RoomSync** — matching współlokatorów (akademiki): preferencje płci, wzajemne „Sync”,
  panel administratora. Mocno „studenckie”, mniej o samodzielnym zajmowaniu pokojów na żywo.
- **StarRez** — kompleksowy system zakwaterowania uczelnianego z self-selection pokojów.
  Ciężki, enterprise, dla instytucji — nie dla małej grupy wyjazdowej.
- **Gruppenplan** — przydział kabin/miejsc dla grup (rejsy, obozy) z algorytmem
  optymalizującym i samodzielnym wpisaniem współlokatorów. Najbliżej idei „zapisów na żywo”.
- **YouLi / AvoSquado / RoomTrust** — narzędzia do organizacji wyjazdów grupowych,
  w których jest moduł rooming-list / przydziału łóżek i self-service uczestnika.

Wniosek: warto budować własne rozwiązanie skrojone pod nieformalną grupę,
biorąc z powyższych dobre wzorce (self-service, matching płci, panel organizatora).
