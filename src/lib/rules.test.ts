import { describe, it, expect } from "vitest";
import { unmetRules, splitBySeverity, tripStatus } from "./rules";
import type { Assignment, Participant, Rule } from "../types/domain";

const trip = "t1";
const p = (id: string, gender: Participant["gender"]): Participant => ({
  id,
  trip_id: trip,
  name: id,
  email: null,
  gender,
});
const assign = (pid: string, room: string): Assignment => ({
  id: `a-${pid}`,
  trip_id: trip,
  participant_id: pid,
  room_id: room,
});

describe("same_gender rule", () => {
  const participants = [p("alice", "female"), p("bob", "male")];
  const rule: Rule = {
    id: "r1",
    participant_id: "alice",
    type: "same_gender",
    strictness: "must_have",
    target_participant_id: null,
  };

  it("is unmet when a roommate has a different gender", () => {
    const assignments = [assign("alice", "A"), assign("bob", "A")];
    expect(unmetRules([rule], assignments, participants)).toHaveLength(1);
  });

  it("is satisfied when roommates share the gender", () => {
    const carol = p("carol", "female");
    const assignments = [assign("alice", "A"), assign("carol", "A")];
    expect(unmetRules([rule], assignments, [...participants, carol])).toHaveLength(0);
  });
});

describe("preferred_person rule", () => {
  const participants = [p("alice", "female"), p("dave", "male")];
  const rule: Rule = {
    id: "r2",
    participant_id: "alice",
    type: "preferred_person",
    strictness: "preference",
    target_participant_id: "dave",
  };

  it("is unmet when the preferred person is in another room", () => {
    const assignments = [assign("alice", "A"), assign("dave", "B")];
    const unmet = unmetRules([rule], assignments, participants);
    expect(splitBySeverity(unmet).preferences).toHaveLength(1);
    expect(splitBySeverity(unmet).critical).toHaveLength(0);
  });

  it("is satisfied when both share a room", () => {
    const assignments = [assign("alice", "A"), assign("dave", "A")];
    expect(unmetRules([rule], assignments, participants)).toHaveLength(0);
  });
});

describe("tripStatus colour signal", () => {
  it("is a violation when any MUST-HAVE is unmet", () => {
    expect(tripStatus(10, 10, 1)).toBe("violation");
  });
  it("is complete when the target is reached and no violations", () => {
    expect(tripStatus(10, 10, 0)).toBe("complete");
  });
  it("is in progress before reaching the target", () => {
    expect(tripStatus(4, 10, 0)).toBe("in_progress");
  });
});
