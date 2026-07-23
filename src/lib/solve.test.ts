import { describe, expect, it } from "vitest";
import { solve } from "./solve";
import { optimize } from "./optimize";
import type { Assignment, Participant, Room, Rule } from "../types/domain";

const T = "trip-1";
function P(id: string, gender: Participant["gender"] = null): Participant {
  return { id, trip_id: T, name: id, email: null, gender };
}
function A(pid: string, room: string): Assignment {
  return { id: `as-${pid}`, trip_id: T, participant_id: pid, room_id: room };
}
function R(id: string, capacity: number): Room {
  return { id, trip_id: T, name: id, capacity, info: null };
}
function pref(pid: string, target: string): Rule {
  return {
    id: `r-${pid}-${target}`,
    participant_id: pid,
    type: "preferred_person",
    strictness: "preference",
    target_participant_id: target,
  };
}
function sameGender(pid: string): Rule {
  return {
    id: `sg-${pid}`,
    participant_id: pid,
    type: "same_gender",
    strictness: "must_have",
    target_participant_id: null,
  };
}
const cost = (s: { critical: number; preferences: number }) =>
  s.critical * 1_000_000 + s.preferences;

describe("solve", () => {
  it("resolves the NEEDS §9 example (o & p end up together)", () => {
    const participants = ["x", "y", "z", "o", "p"].map((id) => P(id));
    const assignments = [A("x", "A"), A("y", "A"), A("o", "A"), A("z", "B"), A("p", "B")];
    const rooms = [R("A", 3), R("B", 2)];
    const rules = [pref("o", "p"), pref("p", "o")];

    const res = solve(participants, assignments, rooms, rules, { seed: 1 });
    expect(res.before.preferences).toBe(2);
    expect(res.after.preferences).toBe(0);
    expect(res.after.critical).toBe(0);
    expect(res.changed).toBe(true);
    // everyone still assigned, capacities respected
    expect(res.target).toHaveLength(5);
    assertValid(res.target, rooms);
  });

  // The decisive Model-B case: a MUST-HAVE fixable ONLY by moving someone into
  // an empty room. Swap-only (optimize) cannot reach it; the solver can.
  it("fixes a relocation-only MUST-HAVE that swap-only cannot", () => {
    const participants = [P("alice", "female"), P("bob", "male")];
    const assignments = [A("alice", "A"), A("bob", "A")];
    const rooms = [R("A", 2), R("B", 2)]; // B is empty — the free beds
    const rules = [sameGender("alice")];

    const swapOnly = optimize(participants, assignments, rules);
    expect(swapOnly.after.critical).toBe(1); // cannot use the empty room

    const res = solve(participants, assignments, rooms, rules, { seed: 1 });
    expect(res.before.critical).toBe(1);
    expect(res.after.critical).toBe(0); // relocates alice or bob into B
    assertValid(res.target, rooms);
  });

  it("fixes a MUST-HAVE even at the cost of a preference (priority)", () => {
    // 2 females, 2 males, two full rooms of 2. Satisfying alice's same-gender
    // forces the two females together, which breaks carol↔dave preference.
    const participants = [
      P("alice", "female"),
      P("bob", "male"),
      P("carol", "female"),
      P("dave", "male"),
    ];
    const assignments = [A("alice", "A"), A("bob", "A"), A("carol", "B"), A("dave", "B")];
    const rooms = [R("A", 2), R("B", 2)];
    const rules = [sameGender("alice"), pref("carol", "dave")];

    const res = solve(participants, assignments, rooms, rules, { seed: 3 });
    expect(res.before.critical).toBe(1);
    expect(res.after.critical).toBe(0); // critical fixed
    assertValid(res.target, rooms);
  });

  it("returns changed:false when already optimal", () => {
    const participants = [P("a"), P("b")];
    const assignments = [A("a", "A"), A("b", "A")];
    const rooms = [R("A", 2), R("B", 2)];
    const res = solve(participants, assignments, rooms, [pref("a", "b")], { seed: 1 });
    expect(res.changed).toBe(false);
    expect(res.swaps).toHaveLength(0);
    expect(res.moves).toHaveLength(0);
  });

  it("is deterministic for a fixed seed", () => {
    const participants = ["x", "y", "z", "o", "p"].map((id) => P(id));
    const assignments = [A("x", "A"), A("y", "A"), A("o", "A"), A("z", "B"), A("p", "B")];
    const rooms = [R("A", 3), R("B", 2)];
    const rules = [pref("o", "p"), pref("p", "o")];
    const a = solve(participants, assignments, rooms, rules, { seed: 7 });
    const b = solve(participants, assignments, rooms, rules, { seed: 7 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("never makes things worse, and always respects capacity/one-room (fuzz)", () => {
    let rng = 123456789;
    const rand = () => {
      rng = (1103515245 * rng + 12345) & 0x7fffffff;
      return rng / 0x7fffffff;
    };
    for (let iter = 0; iter < 20; iter++) {
      const n = 3 + Math.floor(rand() * 6); // 3..8 people
      const roomCount = 2 + Math.floor(rand() * 2); // 2..3 rooms
      // capacities that comfortably fit everyone (leave spare beds sometimes)
      const rooms: Room[] = [];
      let cap = 0;
      for (let r = 0; r < roomCount; r++) {
        const c = 2 + Math.floor(rand() * 2);
        rooms.push(R(`R${r}`, c));
        cap += c;
      }
      if (cap < n) rooms[0] = R("R0", rooms[0].capacity + (n - cap));
      const participants: Participant[] = [];
      const assignments: Assignment[] = [];
      const fill = new Map(rooms.map((r) => [r.id, 0]));
      for (let i = 0; i < n; i++) {
        const g = (["male", "female", null] as const)[Math.floor(rand() * 3)];
        participants.push(P(`p${i}`, g));
        const avail = rooms.filter((r) => (fill.get(r.id) ?? 0) < r.capacity);
        const room = avail[Math.floor(rand() * avail.length)];
        fill.set(room.id, (fill.get(room.id) ?? 0) + 1);
        assignments.push(A(`p${i}`, room.id));
      }
      const rules: Rule[] = [];
      for (let i = 0; i < n; i++) {
        const roll = rand();
        if (roll < 0.3) rules.push(sameGender(`p${i}`));
        else if (roll < 0.6) {
          const other = `p${Math.floor(rand() * n)}`;
          if (other !== `p${i}`) rules.push(pref(`p${i}`, other));
        }
      }

      const res = solve(participants, assignments, rooms, rules, { seed: iter + 1 });
      // never worse
      expect(cost(res.after)).toBeLessThanOrEqual(cost(res.before));
      if (cost(res.after) === cost(res.before)) expect(res.changed).toBe(false);
      // valid target
      assertValid(res.target, rooms);
      // assigned set unchanged
      expect(res.target.map((r) => r.participantId).sort()).toEqual(
        assignments.map((a) => a.participant_id).sort(),
      );
    }
  });
});

function assertValid(
  target: { participantId: string; roomId: string }[],
  rooms: Room[],
) {
  const capacity = new Map(rooms.map((r) => [r.id, r.capacity]));
  const fill = new Map<string, number>();
  const seen = new Set<string>();
  for (const row of target) {
    expect(seen.has(row.participantId)).toBe(false); // one room per person
    seen.add(row.participantId);
    expect(capacity.has(row.roomId)).toBe(true); // real room
    fill.set(row.roomId, (fill.get(row.roomId) ?? 0) + 1);
  }
  for (const [rid, count] of fill) {
    expect(count).toBeLessThanOrEqual(capacity.get(rid) as number); // capacity
  }
}
