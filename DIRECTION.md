# DIRECTION.md — Wizja i „fajne dodatki”

> **Status dokumentu:** kierunek, w którym **może** zmierzać aplikacja.
> To **nie są** wymagania krytyczne — mogą nigdy nie powstać i to jest OK.
> Wymagania, które *muszą* być spełnione, są w [`NEEDS.md`](./NEEDS.md).
> Ten plik nadaje ogólną wizję i porządkuje pomysły „na potem”.

---

## 1. Komunikacja i automatyzacja
- **Automatyczne rozsyłanie maili** do uczestników: kody do pokojów, lokalizacje,
  przypomnienia, informacja o zbliskim zamknięciu zapisów.
  *(Samo zbieranie e-maili jest w NEEDS.md; automatyczny mailing to dodatek.)*
- Powiadomienia push / w aplikacji o zmianach w „moim” pokoju.
- Eksport listy pokojów (CSV/Excel/PDF) dla recepcji hotelu.

## 2. Preferencje jako negocjacja społeczna
- **Requesty preferencji** między uczestnikami: osoba A wysyła prośbę „chcę z Tobą”,
  osoba B akceptuje → preferencja staje się **dwustronna i potwierdzona**.
  *(W NEEDS.md zostaje prostsze: ręczne wzajemne wpisanie się.)*
- Status preferencji: oczekująca / wzajemna / odrzucona.
- „Grupy znajomych” — definiowanie paczki osób, które chcą trzymać się razem.

## 3. Zaawansowana optymalizacja przydziału
- Pełny **solver** maksymalizujący spełnienie preferencji przy twardych ograniczeniach
  (limity, MUST HAVE, płeć) — np. model optymalizacyjny / przydział grafowy.
- **Propozycje wymian negocjowane między uczestnikami**: system proponuje zamianę,
  obie strony ją zatwierdzają w aplikacji.
- „Symulacja” — organizator widzi *przed* zastosowaniem, jak zmienią się wskaźniki
  spełnienia preferencji.
- Scoring jakości całego przydziału (np. % spełnionych preferencji).

## 4. Bogatsze reguły i profile uczestników
- Dodatkowe kryteria dopasowania: chrapanie, godzina snu, palenie, cisza/impreza,
  zakres wieku, znajomość języka.
- Profile uczestników z krótkim „opisem współlokatora”.
- „Czarne listy” (z kim na pewno nie chcę).

## 5. Wielowydarzeniowość i organizacja
- Obsługa **wielu wyjazdów** jednocześnie, archiwum poprzednich.
- Wielu współorganizatorów z różnymi uprawnieniami.
- Szablony pokojów (powielanie układu z poprzedniego wyjazdu).
- Historia zmian / audit log „kto, kiedy, co zmienił”.

## 6. UX i dostępność
- Wersja mobilna / PWA, działanie offline-first.
- Link/QR do dołączenia do wyjazdu bez zakładania pełnego konta.
- **Polska wersja językowa UI** (i ew. kolejne języki). UI startowo po angielsku
  jest wymaganiem twardym (`NEEDS §12`); PL dochodzi jako lokalizacja, gdy będzie potrzeba.
- Widok „mapa pokojów” / wizualny układ pięter.

---

## 8. Integracje deweloperskie / AI (np. Claude Code)
Wpięcie automatyzacji i asystentów AI w cykl pracy nad projektem oraz w samą aplikację:
- **Claude Code w repo** — np. `CLAUDE.md` jako kontekst (już jest), hooki SessionStart
  uruchamiające testy/lintery na starcie, automatyczny przegląd PR-ów i poprawki CI.
- **Claude Code on the web / GitHub** — zlecanie zmian i przeglądów z poziomu repo.
- **AI w produkcie** — np. asystent sugerujący przydział pokojów w języku naturalnym
  („posadź te 3 osoby razem, resztę dobierz wg preferencji”) jako nakładka na silnik z `NEEDS §9`.
- Webhooki / API, by spinać aplikację z zewnętrznymi narzędziami (kalendarz, mail, Slack).

> Wszystkie powyższe to **dodatki** — nie mogą naruszać wymagania `NEEDS §11` (ZERO kosztów)
> dla funkcji krytycznych. Jeśli integracja generuje koszt, jest opcjonalna i świadomie włączana.

---

## 7. Benchmark — istniejące rozwiązania (inspiracje, nie wymagania)
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
