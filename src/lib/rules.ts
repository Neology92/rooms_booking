import type { Assignment, Participant, Rule } from "../types/domain";

// Pure rule evaluation (NEEDS §7/§8). No I/O — fully unit-testable.
// A rule is "unmet" when the participant's current room does not satisfy it.
// `must_have` unmet  -> critical (red).  `preference` unmet -> non-critical.

export interface UnmetRule {
  participantId: string;
  rule: Rule;
}

function roomOf(participantId: string, assignments: Assignment[]): string | null {
  return assignments.find((a) => a.participant_id === participantId)?.room_id ?? null;
}

function roommates(
  participantId: string,
  assignments: Assignment[],
  participants: Participant[],
): Participant[] {
  const room = roomOf(participantId, assignments);
  if (!room) return [];
  const ids = assignments
    .filter((a) => a.room_id === room && a.participant_id !== participantId)
    .map((a) => a.participant_id);
  return participants.filter((p) => ids.includes(p.id));
}

function isRuleSatisfied(
  rule: Rule,
  assignments: Assignment[],
  participants: Participant[],
): boolean {
  const self = participants.find((p) => p.id === rule.participant_id);
  const room = roomOf(rule.participant_id, assignments);
  // An unassigned participant has nothing to violate yet.
  if (!self || !room) return true;

  const mates = roommates(rule.participant_id, assignments, participants);

  switch (rule.type) {
    case "same_gender": {
      if (!self.gender) return true; // unknown gender -> cannot judge
      // Satisfied unless a roommate has a *different known* gender.
      return mates.every((m) => m.gender == null || m.gender === self.gender);
    }
    case "preferred_person": {
      if (!rule.target_participant_id) return true;
      return mates.some((m) => m.id === rule.target_participant_id);
    }
  }
}

export function unmetRules(
  rules: Rule[],
  assignments: Assignment[],
  participants: Participant[],
): UnmetRule[] {
  return rules
    .filter((rule) => !isRuleSatisfied(rule, assignments, participants))
    .map((rule) => ({ participantId: rule.participant_id, rule }));
}

export function splitBySeverity(unmet: UnmetRule[]): {
  critical: UnmetRule[];
  preferences: UnmetRule[];
} {
  return {
    critical: unmet.filter((u) => u.rule.strictness === "must_have"),
    preferences: unmet.filter((u) => u.rule.strictness === "preference"),
  };
}

export type TripStatus = "complete" | "in_progress" | "violation";

// Dashboard colour signal (NEEDS §5):
//   violation (red)   -> any MUST-HAVE unmet
//   complete (green)  -> target reached and no MUST-HAVE unmet
//   in_progress (amber) otherwise
export function tripStatus(
  signedUp: number,
  target: number | null,
  criticalCount: number,
): TripStatus {
  if (criticalCount > 0) return "violation";
  if (target != null && signedUp >= target) return "complete";
  return "in_progress";
}
