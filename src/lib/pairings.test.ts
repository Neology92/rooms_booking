import { describe, expect, it } from "vitest";
import { effectiveRules, pairingsToRules, unmetRules } from "./rules";
import type { Assignment, PairingRequest, Participant, Rule } from "../types/domain";

const TRIP = "trip-1";
function p(id: string): Participant {
  return { id, trip_id: TRIP, name: id, email: null, gender: null };
}
function pairing(
  id: string,
  from: string,
  to: string,
  status: PairingRequest["status"],
): PairingRequest {
  return {
    id,
    trip_id: TRIP,
    from_participant_id: from,
    to_participant_id: to,
    status,
    kind: "pair",
  };
}

describe("pairingsToRules", () => {
  it("turns an accepted pairing into two synthetic soft preferences", () => {
    const rules = pairingsToRules([pairing("x", "a", "b", "accepted")], [p("a"), p("b")]);
    expect(rules).toHaveLength(2);
    expect(rules.every((r) => r.type === "preferred_person")).toBe(true);
    expect(rules.every((r) => r.strictness === "preference")).toBe(true);
    // both directions present
    expect(rules.map((r) => `${r.participant_id}->${r.target_participant_id}`).sort()).toEqual(
      ["a->b", "b->a"],
    );
  });

  it("ignores non-accepted pairings", () => {
    const src = [
      pairing("1", "a", "b", "pending"),
      pairing("2", "a", "b", "declined"),
      pairing("3", "a", "b", "withdrawn"),
      pairing("4", "a", "b", "ended"),
    ];
    expect(pairingsToRules(src, [p("a"), p("b")])).toHaveLength(0);
  });

  it("drops a pairing whose participant is no longer in the snapshot", () => {
    // 'b' was deleted; realtime lag could still carry the accepted row.
    expect(pairingsToRules([pairing("x", "a", "b", "accepted")], [p("a")])).toHaveLength(0);
  });
});

describe("effectiveRules", () => {
  it("dedups a synthetic direction against an identical manual preferred_person", () => {
    const manual: Rule = {
      id: "r1",
      participant_id: "a",
      type: "preferred_person",
      strictness: "must_have",
      target_participant_id: "b",
    };
    const eff = effectiveRules([manual], [pairing("x", "a", "b", "accepted")], [p("a"), p("b")]);
    // a->b kept once (the manual must_have wins); b->a synthetic still added.
    const ab = eff.filter((r) => r.participant_id === "a" && r.target_participant_id === "b");
    expect(ab).toHaveLength(1);
    expect(ab[0].strictness).toBe("must_have");
    expect(eff.some((r) => r.participant_id === "b" && r.target_participant_id === "a")).toBe(true);
  });

  it("an accepted pairing shows as an unmet preference when the two are apart", () => {
    const parts = [p("a"), p("b")];
    const assignments: Assignment[] = [
      { id: "1", trip_id: TRIP, participant_id: "a", room_id: "A" },
      { id: "2", trip_id: TRIP, participant_id: "b", room_id: "B" },
    ];
    const eff = effectiveRules([], [pairing("x", "a", "b", "accepted")], parts);
    const unmet = unmetRules(eff, assignments, parts);
    expect(unmet).toHaveLength(2); // a wants b, b wants a — both unmet
    expect(unmet.every((u) => u.rule.strictness === "preference")).toBe(true);
  });

  it("an accepted pairing is satisfied once they share a room", () => {
    const parts = [p("a"), p("b")];
    const assignments: Assignment[] = [
      { id: "1", trip_id: TRIP, participant_id: "a", room_id: "A" },
      { id: "2", trip_id: TRIP, participant_id: "b", room_id: "A" },
    ];
    const eff = effectiveRules([], [pairing("x", "a", "b", "accepted")], parts);
    expect(unmetRules(eff, assignments, parts)).toHaveLength(0);
  });
});
