import { describe, expect, it } from "vitest";
import { optimize } from "./optimize";
import type { Assignment, Participant, Rule } from "../types/domain";

const TRIP = "trip-1";

function p(id: string, gender: Participant["gender"] = null): Participant {
  return { id, trip_id: TRIP, name: id, email: null, gender };
}
function a(participant_id: string, room_id: string): Assignment {
  return { id: `as-${participant_id}`, trip_id: TRIP, participant_id, room_id };
}
function pref(participant_id: string, target: string): Rule {
  return {
    id: `r-${participant_id}-${target}`,
    participant_id,
    type: "preferred_person",
    strictness: "preference",
    target_participant_id: target,
  };
}

describe("optimize", () => {
  // NEEDS §9 worked example:
  // Room A (3): x, y, o   Room B (2): z, p   preference group {o, p}
  // → a single swap puts o and p together. NEEDS suggests o↔z; x↔p is an equally
  // optimal swap. We assert the *outcome* (one swap, all prefs met), not the pair.
  it("resolves the NEEDS example with one swap that satisfies every preference", () => {
    const participants = ["x", "y", "z", "o", "p"].map((id) => p(id));
    const assignments = [
      a("x", "A"),
      a("y", "A"),
      a("o", "A"),
      a("z", "B"),
      a("p", "B"),
    ];
    const rules = [pref("o", "p"), pref("p", "o")];

    const res = optimize(participants, assignments, rules);

    expect(res.before.preferences).toBe(2);
    expect(res.proposals).toHaveLength(1);
    expect(res.after.preferences).toBe(0);
    expect(res.after.critical).toBe(0);
  });

  it("fixes a MUST-HAVE violation before preferences", () => {
    // Alice (f) MUST share same-gender; she's in A with Bob (m). Carol (f) is in B.
    // Swapping Bob <-> Carol puts Alice with Carol (same gender) → critical fixed.
    const participants = [
      p("alice", "female"),
      p("bob", "male"),
      p("carol", "female"),
      p("dave", "male"),
    ];
    const assignments = [
      a("alice", "A"),
      a("bob", "A"),
      a("carol", "B"),
      a("dave", "B"),
    ];
    const rules: Rule[] = [
      {
        id: "r-alice",
        participant_id: "alice",
        type: "same_gender",
        strictness: "must_have",
        target_participant_id: null,
      },
    ];

    const res = optimize(participants, assignments, rules);

    expect(res.before.critical).toBe(1);
    expect(res.proposals.length).toBeGreaterThanOrEqual(1);
    expect(res.after.critical).toBe(0);
  });

  it("returns no proposals when everything is already satisfied", () => {
    const participants = [p("o"), p("p")];
    const assignments = [a("o", "A"), a("p", "A")];
    const rules = [pref("o", "p")];

    const res = optimize(participants, assignments, rules);

    expect(res.proposals).toHaveLength(0);
    expect(res.after.preferences).toBe(0);
  });
});
