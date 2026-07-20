// Domain model — mirrors supabase/migrations/0001_init.sql and CLAUDE.md §3.
export type Gender = "male" | "female" | "other";
export type RuleType = "same_gender" | "preferred_person";
export type RuleStrictness = "must_have" | "preference";

export interface Trip {
  id: string;
  name: string;
  target_headcount: number | null;
  signups_locked: boolean;
  organizer_claimed: boolean;
}

export interface Room {
  id: string;
  trip_id: string;
  name: string;
  capacity: number;
  info: string | null;
}

export interface Participant {
  id: string;
  trip_id: string;
  name: string;
  email: string | null;
  gender: Gender | null;
}

export interface Assignment {
  id: string;
  trip_id: string;
  participant_id: string;
  room_id: string;
}

export interface Rule {
  id: string;
  participant_id: string;
  type: RuleType;
  strictness: RuleStrictness;
  target_participant_id: string | null;
}

export type PairingStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "withdrawn"
  | "ended";

// Negotiated roommate request (DIRECTION.md). An accepted pairing is a mutual
// soft preference, folded into synthetic rules at evaluation time (rules.ts).
export interface PairingRequest {
  id: string;
  trip_id: string;
  from_participant_id: string;
  to_participant_id: string;
  status: PairingStatus;
}
