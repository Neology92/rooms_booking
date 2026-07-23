import { describe, it, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Integration tests for admin_set_assignments (the atomic solver-apply RPC)
// against a real Supabase project. Skipped without creds; see
// concurrency.integration.test.ts. Run: npm run test:integration

declare const process: { env: Record<string, string | undefined> };

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const RUN = Boolean(url && key);
const client: SupabaseClient = RUN
  ? createClient(url as string, key as string)
  : (null as unknown as SupabaseClient);

const PASS = "solver-pass-1234";

async function rpc(name: string, args: Record<string, unknown>) {
  return client.rpc(name, args);
}
async function newTrip() {
  const name = `SOLVE ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await rpc("create_trip", {
    p_name: name,
    p_target_headcount: null,
    p_passcode: PASS,
  });
  if (error) throw new Error(`create_trip: ${error.message}`);
  const tripId = data as string;
  return {
    tripId,
    cleanup: () => rpc("admin_delete_trip", { p_trip_id: tripId, p_passcode: PASS }),
  };
}
async function addRoom(tripId: string, name: string, capacity: number) {
  const { data, error } = await rpc("admin_create_room", {
    p_trip_id: tripId,
    p_name: name,
    p_capacity: capacity,
    p_info: "",
    p_passcode: PASS,
  });
  if (error) throw new Error(`admin_create_room: ${error.message}`);
  return data as string;
}
async function addParticipant(tripId: string, name: string) {
  const { data, error } = await rpc("register_participant", {
    p_trip_id: tripId,
    p_name: name,
    p_email: "",
    p_gender: "",
  });
  if (error) throw new Error(`register_participant: ${error.message}`);
  return data as string;
}

describe.skipIf(!RUN)("admin_set_assignments (integration)", () => {
  it("applies a valid plan atomically and rejects an over-capacity plan", async () => {
    const { tripId, cleanup } = await newTrip();
    try {
      const a = await addRoom(tripId, "A", 2);
      const b = await addRoom(tripId, "B", 2);
      const [p1, p2, p3] = await Promise.all([
        addParticipant(tripId, "P1"),
        addParticipant(tripId, "P2"),
        addParticipant(tripId, "P3"),
      ]);
      await rpc("admin_assign", { p_participant_id: p1, p_room_id: a, p_passcode: PASS });
      await rpc("admin_assign", { p_participant_id: p2, p_room_id: a, p_passcode: PASS });
      await rpc("admin_assign", { p_participant_id: p3, p_room_id: b, p_passcode: PASS });

      // over-capacity → ROOM_FULL, original preserved (atomicity)
      const bad = await rpc("admin_set_assignments", {
        p_trip_id: tripId,
        p_passcode: PASS,
        p_participant_ids: [p1, p2, p3],
        p_room_ids: [a, a, a],
      });
      expect(bad.error?.message).toContain("ROOM_FULL");
      const { data: still } = await client
        .from("assignments")
        .select("participant_id, room_id")
        .eq("participant_id", p1);
      expect(still?.[0]?.room_id).toBe(a);

      // valid plan → applied
      const ok = await rpc("admin_set_assignments", {
        p_trip_id: tripId,
        p_passcode: PASS,
        p_participant_ids: [p1, p2, p3],
        p_room_ids: [b, a, a],
      });
      expect(ok.error).toBeNull();
      const { data: rows } = await client
        .from("assignments")
        .select("participant_id, room_id")
        .eq("trip_id", tripId);
      const byId = new Map(rows?.map((r) => [r.participant_id, r.room_id]));
      expect(byId.get(p1)).toBe(b);
      expect(byId.get(p3)).toBe(a);
    } finally {
      await cleanup();
    }
  });

  it("rejects wrong passcode and an incomplete assignment set", async () => {
    const { tripId, cleanup } = await newTrip();
    try {
      const a = await addRoom(tripId, "A", 3);
      const [p1, p2] = await Promise.all([
        addParticipant(tripId, "P1"),
        addParticipant(tripId, "P2"),
      ]);
      await rpc("admin_assign", { p_participant_id: p1, p_room_id: a, p_passcode: PASS });
      await rpc("admin_assign", { p_participant_id: p2, p_room_id: a, p_passcode: PASS });

      const wrong = await rpc("admin_set_assignments", {
        p_trip_id: tripId,
        p_passcode: "nope",
        p_participant_ids: [p1, p2],
        p_room_ids: [a, a],
      });
      expect(wrong.error?.message).toContain("NOT_ORGANIZER");

      const partial = await rpc("admin_set_assignments", {
        p_trip_id: tripId,
        p_passcode: PASS,
        p_participant_ids: [p1],
        p_room_ids: [a],
      });
      expect(partial.error?.message).toContain("ASSIGNMENT_SET_MISMATCH");
    } finally {
      await cleanup();
    }
  });
});
