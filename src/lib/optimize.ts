import type { Assignment, Participant, Rule } from "../types/domain";
import { splitBySeverity, unmetRules } from "./rules";

// On-demand optimization (NEEDS §9) — the ORIGINAL swap-only heuristic.
//
// STATUS: superseded by `solve.ts` and NOT wired into the UI. It is kept
// deliberately, for two reasons:
//   1. `solve.test.ts` uses it to prove the solver earns its complexity — a
//      MUST-HAVE fixable only by moving someone into an empty room is
//      unreachable by swaps alone, so this module is the regression baseline.
//   2. It documents the cheaper approach if the solver ever needs replacing.
// Before deleting it, move the `Severity` type (solve.ts imports it) elsewhere.
// Tracked in CLAUDE.md §8.6.
//
// Pure + deterministic, so it's unit-testable and runs entirely client-side (no
// DB, no cost). It proposes room *swaps* between two assigned participants —
// swaps keep every room's occupancy count unchanged, so capacity limits
// (invariant §10.2) can never be broken.
//
// Priority is encoded in the cost function: an unmet MUST-HAVE weighs far more
// than an unmet preference, so the greedy search fixes criticals first and only
// then chases preferences. Note `solve.ts` uses a *dynamic* weight instead —
// this fixed 1000 is the less robust of the two (see CLAUDE.md §8.6).

const CRITICAL_WEIGHT = 1000;

export interface Swap {
  aId: string;
  bId: string;
}

export interface Severity {
  critical: number;
  preferences: number;
}

export interface OptimizeResult {
  proposals: Swap[];
  before: Severity;
  after: Severity;
}

function severity(
  assignments: Assignment[],
  participants: Participant[],
  rules: Rule[],
): Severity {
  const { critical, preferences } = splitBySeverity(
    unmetRules(rules, assignments, participants),
  );
  return { critical: critical.length, preferences: preferences.length };
}

function cost(s: Severity): number {
  return s.critical * CRITICAL_WEIGHT + s.preferences;
}

function roomOf(assignments: Assignment[], participantId: string): string | null {
  return (
    assignments.find((a) => a.participant_id === participantId)?.room_id ?? null
  );
}

// Return a new assignments array with a's and b's rooms exchanged.
function applySwap(assignments: Assignment[], aId: string, bId: string): Assignment[] {
  const roomA = roomOf(assignments, aId);
  const roomB = roomOf(assignments, bId);
  return assignments.map((x) => {
    if (x.participant_id === aId && roomB) return { ...x, room_id: roomB };
    if (x.participant_id === bId && roomA) return { ...x, room_id: roomA };
    return x;
  });
}

// Greedy hill-climb over swaps: each step applies the single most cost-reducing
// swap, until nothing improves or maxSteps is hit. "Simple optimization on
// demand" per NEEDS §9 — not a global solver (that's DIRECTION.md territory).
export function optimize(
  participants: Participant[],
  assignments: Assignment[],
  rules: Rule[],
  maxSteps = 25,
): OptimizeResult {
  const before = severity(assignments, participants, rules);
  let current = assignments.slice();
  const proposals: Swap[] = [];

  for (let step = 0; step < maxSteps; step++) {
    const baseCost = cost(severity(current, participants, rules));
    if (baseCost === 0) break;

    let best: Swap | null = null;
    let bestCost = baseCost;

    const assigned = current.map((a) => a.participant_id);
    for (let i = 0; i < assigned.length; i++) {
      for (let j = i + 1; j < assigned.length; j++) {
        const aId = assigned[i];
        const bId = assigned[j];
        if (roomOf(current, aId) === roomOf(current, bId)) continue; // same room
        const trial = applySwap(current, aId, bId);
        const c = cost(severity(trial, participants, rules));
        if (c < bestCost) {
          bestCost = c;
          best = { aId, bId };
        }
      }
    }

    if (!best) break; // local optimum
    proposals.push(best);
    current = applySwap(current, best.aId, best.bId);
  }

  return { proposals, before, after: severity(current, participants, rules) };
}
