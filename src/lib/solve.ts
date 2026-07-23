import type { Assignment, Participant, Room, Rule } from "../types/domain";
import { splitBySeverity, unmetRules } from "./rules";
import type { Severity } from "./optimize";

// On-demand solver (NEEDS §9, "docelowy solver" — DIRECTION.md). Unlike the
// swap-only greedy in optimize.ts, this searches over full assignments allowing
// BOTH swaps and RELOCATIONS into rooms with spare capacity, so it can fix a
// MUST-HAVE that is only solvable by moving someone onto an empty bed (a case
// swap-only can never reach). Pure + deterministic (seeded PRNG) → unit-testable,
// 100% client-side (zero cost). It only rearranges CURRENTLY-ASSIGNED people;
// the set of assigned participants is never changed. Capacity + one-room hold at
// every step by construction, so §10 invariants are safe; the atomic apply RPC
// (admin_set_assignments) re-validates them server-side.

export interface Move {
  participantId: string;
  fromRoomId: string;
  toRoomId: string;
}

export interface SwapView {
  aId: string;
  bId: string;
}

export interface TargetRow {
  participantId: string;
  roomId: string;
}

export interface SolveResult {
  changed: boolean;
  swaps: SwapView[];
  moves: Move[];
  target: TargetRow[];
  before: Severity;
  after: Severity;
}

// Small, fast, seedable PRNG so results are reproducible in tests.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface State {
  order: string[]; // assigned participant ids, stable input order
  room: Map<string, string>; // participant -> room
  fill: Map<string, number>; // room -> occupancy
}

export function solve(
  participants: Participant[],
  assignments: Assignment[],
  rooms: Room[],
  rules: Rule[],
  opts?: { seed?: number; iterations?: number; restarts?: number },
): SolveResult {
  const order = assignments.map((a) => a.participant_id);
  const inputRoom = new Map(assignments.map((a) => [a.participant_id, a.room_id]));
  const capacity = new Map(rooms.map((r) => [r.id, r.capacity]));

  // Dynamic weight: one unmet MUST-HAVE must outweigh EVERY possible unmet
  // preference, so criticals are always fixed before preferences (NEEDS §9).
  const W = rules.filter((r) => r.strictness === "preference").length + 1;

  const severityOf = (room: Map<string, string>): Severity => {
    const snap: Assignment[] = order.map((pid, i) => ({
      id: String(i),
      trip_id: "",
      participant_id: pid,
      room_id: room.get(pid) as string,
    }));
    const { critical, preferences } = splitBySeverity(
      unmetRules(rules, snap, participants),
    );
    return { critical: critical.length, preferences: preferences.length };
  };
  const costOf = (room: Map<string, string>): number => {
    const s = severityOf(room);
    return s.critical * W + s.preferences;
  };

  const before = severityOf(inputRoom);
  const beforeCost = before.critical * W + before.preferences;

  function makeState(room: Map<string, string>): State {
    const fill = new Map<string, number>(rooms.map((r) => [r.id, 0]));
    for (const rid of room.values()) fill.set(rid, (fill.get(rid) ?? 0) + 1);
    return { order, room: new Map(room), fill };
  }

  // ---- neighbour moves (each feasible by construction) ----------------------
  function relocate(st: State, rng: () => number): (() => void) | null {
    if (order.length === 0) return null;
    const pid = order[Math.floor(rng() * order.length)];
    const from = st.room.get(pid) as string;
    const targets = rooms.filter(
      (r) => r.id !== from && (st.fill.get(r.id) ?? 0) < (capacity.get(r.id) ?? 0),
    );
    if (targets.length === 0) return null;
    const to = targets[Math.floor(rng() * targets.length)].id;
    st.room.set(pid, to);
    st.fill.set(from, (st.fill.get(from) as number) - 1);
    st.fill.set(to, (st.fill.get(to) as number) + 1);
    return () => {
      st.room.set(pid, from);
      st.fill.set(to, (st.fill.get(to) as number) - 1);
      st.fill.set(from, (st.fill.get(from) as number) + 1);
    };
  }
  function swapMove(st: State, rng: () => number): (() => void) | null {
    if (order.length < 2) return null;
    for (let tries = 0; tries < 12; tries++) {
      const a = order[Math.floor(rng() * order.length)];
      const b = order[Math.floor(rng() * order.length)];
      if (a === b) continue;
      const ra = st.room.get(a) as string;
      const rb = st.room.get(b) as string;
      if (ra === rb) continue;
      st.room.set(a, rb);
      st.room.set(b, ra);
      return () => {
        st.room.set(a, ra);
        st.room.set(b, rb);
      };
    }
    return null;
  }
  function neighbour(st: State, rng: () => number): (() => void) | null {
    return rng() < 0.5
      ? relocate(st, rng) ?? swapMove(st, rng)
      : swapMove(st, rng) ?? relocate(st, rng);
  }

  // ---- greedy first-improvement descent to a local minimum ------------------
  function polish(st: State): void {
    const cap = 4 * order.length + 10;
    for (let step = 0; step < cap; step++) {
      const base = costOf(st.room);
      if (base === 0) return;
      let improved = false;
      // relocations
      for (const pid of order) {
        const from = st.room.get(pid) as string;
        for (const r of rooms) {
          if (r.id === from) continue;
          if ((st.fill.get(r.id) ?? 0) >= (capacity.get(r.id) ?? 0)) continue;
          st.room.set(pid, r.id);
          if (costOf(st.room) < base) {
            st.fill.set(from, (st.fill.get(from) as number) - 1);
            st.fill.set(r.id, (st.fill.get(r.id) as number) + 1);
            improved = true;
            break;
          }
          st.room.set(pid, from);
        }
        if (improved) break;
      }
      if (improved) continue;
      // swaps
      for (let i = 0; i < order.length && !improved; i++) {
        for (let j = i + 1; j < order.length; j++) {
          const a = order[i];
          const b = order[j];
          const ra = st.room.get(a) as string;
          const rb = st.room.get(b) as string;
          if (ra === rb) continue;
          st.room.set(a, rb);
          st.room.set(b, ra);
          if (costOf(st.room) < base) {
            improved = true;
            break;
          }
          st.room.set(a, ra);
          st.room.set(b, rb);
        }
      }
      if (!improved) return;
    }
  }

  function anneal(st: State, rng: () => number, iters: number): void {
    const T0 = W;
    let T = T0;
    const alpha = Math.pow(1e-3 / T0, 1 / Math.max(1, iters));
    let cur = costOf(st.room);
    for (let i = 0; i < iters; i++) {
      const undo = neighbour(st, rng);
      if (undo) {
        const next = costOf(st.room);
        const d = next - cur;
        if (d <= 0 || rng() < Math.exp(-d / T)) cur = next;
        else undo();
      }
      T *= alpha;
    }
  }

  const n = order.length;
  const seed = opts?.seed ?? 0x9e3779b9;
  const rng = mulberry32(seed);
  const iters = opts?.iterations ?? Math.min(8000, Math.max(1500, 200 * n));
  const restarts =
    opts?.restarts ?? Math.min(6, Math.max(3, Math.round(30 / Math.sqrt(n || 1))));

  // Best starts at the INPUT and is only replaced on a strictly lower cost →
  // the result is mathematically never worse than the current arrangement.
  let bestRoom = new Map(inputRoom);
  let bestCost = beforeCost;

  const consider = (st: State) => {
    const c = costOf(st.room);
    if (c < bestCost) {
      bestCost = c;
      bestRoom = new Map(st.room);
    }
  };

  // Restart 0: deterministic greedy descent from the real starting point (so we
  // always at least match a plain hill-climb).
  if (n >= 2) {
    const s0 = makeState(inputRoom);
    polish(s0);
    consider(s0);

    for (let r = 1; r < restarts; r++) {
      const st = makeState(inputRoom);
      const kicks = Math.min(10, Math.max(2, n));
      for (let k = 0; k < kicks; k++) neighbour(st, rng);
      anneal(st, rng, iters);
      polish(st);
      consider(st);
    }
  }

  const after = severityOf(bestRoom);
  const changed = bestCost < beforeCost;

  // ---- diff bestRoom vs input → human-readable swaps + moves ---------------
  const swaps: SwapView[] = [];
  const moves: Move[] = [];
  if (changed) {
    const changedPids = order.filter((pid) => bestRoom.get(pid) !== inputRoom.get(pid));
    const consumed = new Set<string>();
    for (const a of changedPids) {
      if (consumed.has(a)) continue;
      const aFrom = inputRoom.get(a) as string;
      const aTo = bestRoom.get(a) as string;
      // A true exchange: some b goes aTo->aFrom.
      const b = changedPids.find(
        (x) =>
          !consumed.has(x) &&
          x !== a &&
          inputRoom.get(x) === aTo &&
          bestRoom.get(x) === aFrom,
      );
      if (b) {
        consumed.add(a);
        consumed.add(b);
        swaps.push({ aId: a, bId: b });
      } else {
        consumed.add(a);
        moves.push({ participantId: a, fromRoomId: aFrom, toRoomId: aTo });
      }
    }
  }

  const target: TargetRow[] = order.map((pid) => ({
    participantId: pid,
    roomId: bestRoom.get(pid) as string,
  }));

  return { changed, swaps, moves, target, before, after };
}
