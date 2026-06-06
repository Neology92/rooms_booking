# NEEDS.md — Potrzeby, zakres i wymagania krytyczne

> **Status dokumentu:** źródło prawdy dla założeń **kluczowych**.
> Wszystko, co tu zapisane, **musi zostać uwzględnione, zrealizowane i utrzymane**.
> Pomysły „fajne, ale niekonieczne” mieszkają w [`DIRECTION.md`](./DIRECTION.md).
> Jak korzystać z tego pliku w codziennej pracy → patrz [`INDEX.md`](./INDEX.md).

---

## 1. Cel aplikacji
Aplikacja pomaga **organizatorom wyjazdu grupowego** rozdzielać uczestników do pokojów,
a **uczestnikom** pozwala zapisywać się samodzielnie i na bieżąco widzieć stan zapisów.

Rozwiązywany problem: ręczne zbieranie „kto z kim w pokoju” (arkusze, czaty, kartki)
jest chaotyczne, podatne na dublowanie i trudne do kontrolowania w czasie rzeczywistym.

---

## 2. Role użytkowników
- **Organizator** — tworzy wyjazd, definiuje pokoje, kontroluje i ręcznie koryguje zapisy.
- **Uczestnik** — zapisuje się do pokoju, zarządza swoimi preferencjami i wymaganiami.

---

## 3. Zarządzanie pokojami (Organizator)
- [ ] Organizator wprowadza **listę pokojów**, do których można się zapisywać.
- [ ] Każdy pokój ma **liczbę miejsc (limit)**.
- [ ] Organizator może ustawić **docelową liczbę uczestników** całego wyjazdu
      (do informacji „czy wszyscy już się zapisali”).
- [ ] Organizator może **ręcznie zablokować zapisy (lock)** — zamrożenie aktualnego
      stanu, po którym uczestnicy nie mogą już zmieniać przypisań.

## 4. Zapisy uczestników
- [ ] Uczestnik zapisuje się do pokoju **przez aplikację**.
- [ ] **Podgląd na żywo**: ile osób i **kto konkretnie** jest w danym pokoju.
- [ ] Gdy pokój jest **pełny (limit osiągnięty)** — **nie można dołączyć ponad limit**.
- [ ] Uczestnik może się **wypisać** z pokoju.
- [ ] Uczestnik może się **przepisać** z jednego pokoju do drugiego.
- [ ] **Brak dublowania zapisów:** zapis do nowego pokoju **automatycznie wypisuje**
      uczestnika z poprzedniego. Uczestnik może być **maks. w jednym pokoju naraz**.

## 5. Dashboard organizatora
- [ ] Podgląd **ilu uczestników się zapisało** (łącznie i per pokój).
- [ ] **Sygnał sensoryczny (np. kolor)** informujący, czy osiągnięto docelową liczbę
      zapisanych (np. zielony = komplet, żółty = w toku, czerwony = problem).
- [ ] Podgląd **kto dokładnie jest w jakim pokoju**.
- [ ] Możliwość **ręcznych zmian** przypisań przez organizatora (override).

## 6. Dane kontaktowe
- [ ] Przechowywanie **adresów e-mail uczestników** (na potrzeby komunikacji,
      np. rozsyłki kodów do pokojów / lokalizacji).
      *Samo automatyczne rozsyłanie maili — patrz `DIRECTION.md`.*

## 7. Preferencje i wymagania uczestników — rozróżnienie KLUCZOWE
Każda reguła uczestnika jest jednego z dwóch typów:

- **MUST HAVE / WYMAGANE (twarde)** — traktowane jako **problem krytyczny**.
  Jeśli nie jest spełnione, organizator **musi to widzieć wyraźnie** (np. czerwono na białym)
  i **musi to zostać naprawione**.
- **PREFERENCJA (miękka)** — staramy się spełnić; jeśli się nie uda, to **niedogodność,
  nie problem krytyczny**.

Wymagane reguły / preferencje (każda może być MUST HAVE **lub** preferencją):
- [ ] **Płeć współlokatorów** (np. „chcę być w pokoju z osobami tej samej płci”).
- [ ] **Preferowane osoby** — z kim uczestnik chce być w pokoju.
- [ ] Wprowadzanie wzajemnych preferencji **ręcznie** (obie strony wpisują siebie).

### 7.1. UX wokół rozróżnienia
- [ ] Interfejs **aktywnie sugeruje**, by oznaczać **MUST HAVE tylko gdy jest to naprawdę
      konieczne**, a nie z „widzimisię”. Domyślnie reguła jest preferencją.

## 8. Kontrola spełnienia reguł (Dashboard organizatora)
- [ ] Dla każdego pokoju / osoby widać, **które reguły są spełnione, a które nie**.
- [ ] **Naruszone MUST HAVE** są wyróżnione jako **krytyczne** (czerwone).
      Przykład: osoba oznaczyła „tylko ta sama płeć”, a jest w pokoju z inną płcią.
- [ ] **Niespełnione preferencje** są widoczne, ale oznaczone jako niekrytyczne.

## 9. Optymalizacja przydziału (na żądanie organizatora)
- [ ] Organizator może **zlecić automatyczne przeliczenie** przydziałów.
- [ ] Algorytm działa **priorytetowo**:
  1. **Najpierw** rozwiązuje **problemy krytyczne (MUST HAVE)**.
  2. **Następnie** maksymalizuje spełnienie **preferencji**.
- [ ] Wynik prezentowany jako **propozycje zamian** między uczestnikami
      (np. „zamień osobę Z i O miejscami”), z poszanowaniem limitów pokojów.

> **Przykład (z założeń autora):**
> Pokój A (3 os.): x, y, **o** · Pokój B (2 os.): z, **p**
> Preferencje grup: {a, b, c} oraz **{o, p}**
> → System proponuje **zamianę o ↔ z**, by o i p trafili do jednego pokoju.

*Zaawansowane formy tej funkcji (pełny solver, propozycje wymian negocjowane między
uczestnikami) — patrz `DIRECTION.md`. Tu wymagane minimum: wykrywanie i wyraźne
oznaczanie naruszeń oraz prosta optymalizacja na żądanie.*

---

## 10. Reguły niezmienne (invarianty systemu)
Te zasady muszą być prawdziwe **zawsze**, niezależnie od ścieżki w aplikacji:
1. Uczestnik jest w **co najwyżej jednym** pokoju.
2. Liczba osób w pokoju **nigdy nie przekracza limitu** (także przy równoczesnych zapisach).
3. Po włączeniu **locka** uczestnicy nie zmieniają przypisań (zmiany tylko po stronie organizatora).
4. Naruszony **MUST HAVE** jest zawsze widoczny jako stan krytyczny.

---

## 11. Poza zakresem (na teraz)
- Płatności / rozliczenia za pokoje.
- Rezerwacje w realnych systemach hotelowych (PMS/booking).
- Pełne planowanie wyjazdu (transport, agenda) — to robią inne narzędzia.
