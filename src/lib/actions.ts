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
): Promise<ActionResult> {
  if (!supabase) return { ok: false, error: en.errors.UNKNOWN };
  const { error } = await supabase.rpc("set_signups_lock", {
    p_trip_id: tripId,
    p_locked: locked,
  });
  return error ? { ok: false, error: toMessage(error.message) } : { ok: true };
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
