// =============================================================================
// send-room-emails — organizer-triggered mailing (DIRECTION §1, zero-cost §11)
// Sends every participant (who left an e-mail) their room assignment for a trip,
// via Resend's batch API. Organizer-only: the caller must present the trip's
// organizer passcode; it is verified server-side through the existing
// verify_organizer RPC (bcrypt, 0005) — same trust model as the dashboard.
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY  — required. Free tier: 100 mails/day, batch ≤100 per call.
//   MAIL_FROM       — optional sender, e.g. "Rooms <rooms@yourdomain.example>".
//                     Defaults to Resend's test sender, which can ONLY deliver
//                     to the Resend account owner's own address — set a verified
//                     domain sender before mailing real participants.
//
// Free-plan safety: one blast ≈ #participants-with-email (≤ trip size), well
// under 100/day for a 40-person trip. No loops, no retries that multiply sends.
// =============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  let payload: { trip_id?: string; passcode?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "BAD_REQUEST" }, 400);
  }
  const { trip_id, passcode } = payload;
  if (!trip_id || !passcode) return json({ error: "BAD_REQUEST" }, 400);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return json({ error: "MAIL_NOT_CONFIGURED" }, 500);
  const from = Deno.env.get("MAIL_FROM") ?? "Rooms <onboarding@resend.dev>";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Organizer gate — server-side, same bcrypt check the dashboard RPCs use.
  const { data: isOrganizer, error: verifyError } = await supabase.rpc(
    "verify_organizer",
    { p_trip_id: trip_id, p_passcode: passcode },
  );
  if (verifyError) return json({ error: "VERIFY_FAILED" }, 500);
  if (!isOrganizer) return json({ error: "NOT_ORGANIZER" }, 403);

  const [tripRes, roomsRes, participantsRes, assignmentsRes] =
    await Promise.all([
      supabase.from("trips").select("id, name").eq("id", trip_id).single(),
      supabase.from("rooms").select("id, name, info").eq("trip_id", trip_id),
      supabase
        .from("participants")
        .select("id, name, email")
        .eq("trip_id", trip_id),
      supabase
        .from("assignments")
        .select("participant_id, room_id")
        .eq("trip_id", trip_id),
    ]);
  if (tripRes.error || !tripRes.data) return json({ error: "TRIP_NOT_FOUND" }, 404);

  const trip = tripRes.data;
  const rooms = roomsRes.data ?? [];
  const participants = participantsRes.data ?? [];
  const assignments = assignmentsRes.data ?? [];
  const roomOf = new Map(assignments.map((a) => [a.participant_id, a.room_id]));
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  const recipients = participants.filter(
    (p) => p.email && p.email.includes("@"),
  );
  const skippedNoEmail = participants.length - recipients.length;
  if (recipients.length === 0) {
    return json({ sent: 0, skipped_no_email: skippedNoEmail });
  }

  const batch = recipients.map((p) => {
    const room = roomById.get(roomOf.get(p.id) ?? "");
    const subject = `Your room for ${trip.name}`;
    const roomLine = room
      ? `<p>Your room: <strong>${escapeHtml(room.name)}</strong>${
          room.info ? ` — ${escapeHtml(room.info)}` : ""
        }</p>`
      : `<p>You are not in a room yet — pick one in the app before sign-ups close.</p>`;
    return {
      from,
      to: [p.email as string],
      subject,
      html:
        `<p>Hi ${escapeHtml(p.name)},</p>` +
        roomLine +
        `<p style="color:#6b7280;font-size:13px">Trip: ${escapeHtml(trip.name)}</p>`,
    };
  });

  // Resend batch endpoint: up to 100 messages per call — one call per blast.
  const resendRes = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(batch),
  });
  if (!resendRes.ok) {
    const detail = await resendRes.text();
    return json({ error: "SEND_FAILED", detail }, 502);
  }

  return json({ sent: batch.length, skipped_no_email: skippedNoEmail });
});

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
