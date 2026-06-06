import { supabase } from "./supabase";
import { en } from "../i18n/strings";

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
