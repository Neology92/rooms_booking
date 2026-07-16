import { supabase } from "./supabase";
import { en } from "../i18n/strings";
import type { RuleStrictness, RuleType } from "../types/domain";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// Maps a Postgres error raised by our RPCs to a friendly, localized message.
function toMessage(message: string | undefined): string {
  if (!message) return en.errors.UNKNOWN;
  for (const key of Object.keys(en.errors) as (keyof typeof en.errors)[]) {
    if (message.includes(key)) return en.errors[key];
  }
  return en.errors.UNKNOWN;
}

export async function joinRoom(
  participantId: string,
  roomId: string,
): Promise<ActionResult> {
  if (!supabase) return { ok: false, error: en.errors.UNKNOWN };
  const { error } = await supabase.rpc("join_room", {
    p_participant_id: participantId,
    p_room_id: roomId,
  });
  return error ? { ok: false, error: toMessage(error.message) } : { ok: true };
}

export async function leaveRoom(participantId: string): Promise<ActionResult> {
  if (!supabase) return { ok: false, error: en.errors.UNKNOWN };
  const { error } = await supabase.rpc("leave_room", {
    p_participant_id: participantId,
  });
  return error ? { ok: false, error: toMessage(error.message) } : { ok: true };
}

export async function setSignupsLock(
  tripId: string,
  locked: boolean,
  passcode: string,
): Promise<ActionResult> {
  if (!supabase) return { ok: false, error: en.errors.UNKNOWN };
  const { error } = await supabase.rpc("set_signups_lock", {
    p_trip_id: tripId,
    p_locked: locked,
    p_passcode: passcode,
  });
  return error ? { ok: false, error: toMessage(error.message) } : { ok: true };
}

// ---- organizer authorization (Phase 4) -------------------------------------
// Claim a trip (first passcode) or rotate it. `current` is ignored for an
// unclaimed trip and required to change an existing passcode.
export async function setOrganizerPasscode(
  tripId: string,
  current: string,
  next: string,
): Promise<ActionResult> {
  if (!supabase) return { ok: false, error: en.errors.UNKNOWN };
  const { error } = await supabase.rpc("set_organizer_passcode", {
    p_trip_id: tripId,
    p_current_passcode: current,
    p_new_passcode: next,
  });
  return error ? { ok: false, error: toMessage(error.message) } : { ok: true };
}

export interface VerifyResult extends ActionResult {
  valid?: boolean;
}

export async function verifyOrganizer(
  tripId: string,
  passcode: string,
): Promise<VerifyResult> {
  if (!supabase) return { ok: false, error: en.errors.UNKNOWN };
  const { data, error } = await supabase.rpc("verify_organizer", {
    p_trip_id: tripId,
    p_passcode: passcode,
  });
  if (error) return { ok: false, error: toMessage(error.message) };
  return { ok: true, valid: data as boolean };
}

export interface RegisterResult extends ActionResult {
  id?: string;
}

export async function registerParticipant(
  tripId: string,
  name: string,
  email: string,
  gender: string,
): Promise<RegisterResult> {
  if (!supabase) return { ok: false, error: en.errors.UNKNOWN };
  const { data, error } = await supabase.rpc("register_participant", {
    p_trip_id: tripId,
    p_name: name,
    p_email: email,
    p_gender: gender,
  });
  if (error) return { ok: false, error: toMessage(error.message) };
  return { ok: true, id: data as string };
}

export async function setRule(
  participantId: string,
  type: RuleType,
  strictness: RuleStrictness,
  targetParticipantId?: string,
): Promise<ActionResult> {
  if (!supabase) return { ok: false, error: en.errors.UNKNOWN };
  const { error } = await supabase.rpc("set_rule", {
    p_participant_id: participantId,
    p_type: type,
    p_strictness: strictness,
    p_target_participant_id: targetParticipantId ?? null,
  });
  return error ? { ok: false, error: toMessage(error.message) } : { ok: true };
}

export async function clearRule(
  participantId: string,
  type: RuleType,
): Promise<ActionResult> {
  if (!supabase) return { ok: false, error: en.errors.UNKNOWN };
  const { error } = await supabase.rpc("clear_rule", {
    p_participant_id: participantId,
    p_type: type,
  });
  return error ? { ok: false, error: toMessage(error.message) } : { ok: true };
}

// Organizer overrides (Phase 3): place/remove a participant, bypassing the lock
// but still enforcing capacity + one-room-per-person server-side.
export async function adminAssign(
  participantId: string,
  roomId: string,
  passcode: string,
): Promise<ActionResult> {
  if (!supabase) return { ok: false, error: en.errors.UNKNOWN };
  const { error } = await supabase.rpc("admin_assign", {
    p_participant_id: participantId,
    p_room_id: roomId,
    p_passcode: passcode,
  });
  return error ? { ok: false, error: toMessage(error.message) } : { ok: true };
}

export async function adminUnassign(
  participantId: string,
  passcode: string,
): Promise<ActionResult> {
  if (!supabase) return { ok: false, error: en.errors.UNKNOWN };
  const { error } = await supabase.rpc("admin_unassign", {
    p_participant_id: participantId,
    p_passcode: passcode,
  });
  return error ? { ok: false, error: toMessage(error.message) } : { ok: true };
}

// ---- trip & room management (NEEDS §2/§3) ----------------------------------
export async function createTrip(
  name: string,
  targetHeadcount: number | null,
  passcode: string,
): Promise<RegisterResult> {
  if (!supabase) return { ok: false, error: en.errors.UNKNOWN };
  const { data, error } = await supabase.rpc("create_trip", {
    p_name: name,
    p_target_headcount: targetHeadcount,
    p_passcode: passcode,
  });
  if (error) return { ok: false, error: toMessage(error.message) };
  return { ok: true, id: data as string };
}

export async function adminCreateRoom(
  tripId: string,
  name: string,
  capacity: number,
  info: string,
  passcode: string,
): Promise<ActionResult> {
  if (!supabase) return { ok: false, error: en.errors.UNKNOWN };
  const { error } = await supabase.rpc("admin_create_room", {
    p_trip_id: tripId,
    p_name: name,
    p_capacity: capacity,
    p_info: info,
    p_passcode: passcode,
  });
  return error ? { ok: false, error: toMessage(error.message) } : { ok: true };
}

export async function adminUpdateRoom(
  roomId: string,
  name: string,
  capacity: number,
  info: string,
  passcode: string,
): Promise<ActionResult> {
  if (!supabase) return { ok: false, error: en.errors.UNKNOWN };
  const { error } = await supabase.rpc("admin_update_room", {
    p_room_id: roomId,
    p_name: name,
    p_capacity: capacity,
    p_info: info,
    p_passcode: passcode,
  });
  return error ? { ok: false, error: toMessage(error.message) } : { ok: true };
}

export async function adminDeleteRoom(
  roomId: string,
  passcode: string,
): Promise<ActionResult> {
  if (!supabase) return { ok: false, error: en.errors.UNKNOWN };
  const { error } = await supabase.rpc("admin_delete_room", {
    p_room_id: roomId,
    p_passcode: passcode,
  });
  return error ? { ok: false, error: toMessage(error.message) } : { ok: true };
}

export async function adminSetTarget(
  tripId: string,
  target: number | null,
  passcode: string,
): Promise<ActionResult> {
  if (!supabase) return { ok: false, error: en.errors.UNKNOWN };
  const { error } = await supabase.rpc("admin_set_target", {
    p_trip_id: tripId,
    p_target: target,
    p_passcode: passcode,
  });
  return error ? { ok: false, error: toMessage(error.message) } : { ok: true };
}

// Apply one optimizer swap proposal (Phase 5): two participants exchange rooms.
export async function adminSwap(
  aId: string,
  bId: string,
  passcode: string,
): Promise<ActionResult> {
  if (!supabase) return { ok: false, error: en.errors.UNKNOWN };
  const { error } = await supabase.rpc("admin_swap", {
    p_a: aId,
    p_b: bId,
    p_passcode: passcode,
  });
  return error ? { ok: false, error: toMessage(error.message) } : { ok: true };
}
