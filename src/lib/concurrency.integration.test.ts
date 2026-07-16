import { describe, it, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Node's `process` — declared locally so we don't pull @types/node into a
// browser-only project just for these integration tests.
declare const process: { env: Record<string, string | undefined> };

// Integration tests for the invariants that can ONLY be proven against a real
// Postgres: capacity under a race, one-room-per-person, and the server-side
// sign-up lock (NEEDS §10.1–§10.3, CLAUDE §5). They hit the live Supabase
// project via anonymous RPCs, create a throwaway trip, and delete it afterwards.
//
// Run:  VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run test:integration
// Skipped automatically when those env vars are absent (e.g. plain `npm test`).

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const RUN = Boolean(url && key);
const client: SupabaseClient = RUN
  ? createClient(url as string, key as string)
  : (null as unknown as SupabaseClient);

const PASSCODE = "test-pass-1234";

async function newTrip() {
  const name = `CONC ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await client.rpc("create_trip", {
    p_name: name,
    p_target_headcount: null,
    p_passcode: PASSCODE,
  });
  if (error) throw new Error(`create_trip: ${error.message}`);
  const tripId = data as string;
  return {
    tripId,
    cleanup: () =>
      client.rpc("admin_delete_trip", { p_trip_id: tripId, p_passcode: PASSCODE }),
  };
}

async function addRoom(tripId: string, name: string, capacity: number) {
  const { data, error } = await client.rpc("admin_create_room", {
    p_trip_id: tripId,
    p_name: name,
    p_capacity: capacity,
    p_info: "",
    p_passcode: PASSCODE,
  });
  if (error) throw new Error(`admin_create_room: ${error.message}`);
  return data as string;
}

async function addParticipant(tripId: string, name: string) {
  const { data, error } = await client.rpc("register_participant", {
    p_trip_id: tripId,
    p_name: name,
    p_email: "",
    p_gender: "",
  });
  if (error) throw new Error(`register_participant: ${error.message}`);
  return data as string;
}

describe.skipIf(!RUN)("concurrency invariants (integration)", () => {
  // §10.2 — many people race for the last (only) spot; capacity must hold.
  it("lets exactly one of many concurrent joiners win the last spot", async () => {
    const { tripId, cleanup } = await newTrip();
    try {
      const room = await addRoom(tripId, "R", 1);
      const people = await Promise.all(
        Array.from({ length: 8 }, (_, i) => addParticipant(tripId, `P${i}`)),
      );

      const results = await Promise.all(
        people.map((pid) =>
          client.rpc("join_room", { p_participant_id: pid, p_room_id: room }),
        ),
      );

      const succeeded = results.filter((r) => !r.error).length;
      const roomFull = results.filter((r) =>
        r.error?.message.includes("ROOM_FULL"),
      ).length;

      expect(succeeded).toBe(1);
      expect(roomFull).toBe(people.length - 1);

      const { data: rows } = await client
        .from("assignments")
        .select("participant_id")
        .eq("room_id", room);
      expect(rows?.length).toBe(1);
    } finally {
      await cleanup();
    }
  });

  // §10.1 — the same person joining two rooms at once ends up in exactly one.
  it("keeps a participant in at most one room under concurrent joins", async () => {
    const { tripId, cleanup } = await newTrip();
    try {
      const roomA = await addRoom(tripId, "A", 5);
      const roomB = await addRoom(tripId, "B", 5);
      const pid = await addParticipant(tripId, "Solo");

      await Promise.all([
        client.rpc("join_room", { p_participant_id: pid, p_room_id: roomA }),
        client.rpc("join_room", { p_participant_id: pid, p_room_id: roomB }),
        client.rpc("join_room", { p_participant_id: pid, p_room_id: roomA }),
      ]);

      const { data: rows } = await client
        .from("assignments")
        .select("room_id")
        .eq("participant_id", pid);
      expect(rows?.length).toBe(1);
    } finally {
      await cleanup();
    }
  });

  // §10.3 — once locked, participants can't change; only the organizer can.
  it("enforces the sign-up lock on the server (organizer still bypasses it)", async () => {
    const { tripId, cleanup } = await newTrip();
    try {
      const roomA = await addRoom(tripId, "A", 5);
      const roomB = await addRoom(tripId, "B", 5);
      const pid = await addParticipant(tripId, "Locked");

      const first = await client.rpc("join_room", {
        p_participant_id: pid,
        p_room_id: roomA,
      });
      expect(first.error).toBeNull();

      const lock = await client.rpc("set_signups_lock", {
        p_trip_id: tripId,
        p_locked: true,
        p_passcode: PASSCODE,
      });
      expect(lock.error).toBeNull();

      const join = await client.rpc("join_room", {
        p_participant_id: pid,
        p_room_id: roomB,
      });
      expect(join.error?.message).toContain("SIGNUPS_LOCKED");

      const leave = await client.rpc("leave_room", { p_participant_id: pid });
      expect(leave.error?.message).toContain("SIGNUPS_LOCKED");

      // Organizer override works despite the lock.
      const admin = await client.rpc("admin_assign", {
        p_participant_id: pid,
        p_room_id: roomB,
        p_passcode: PASSCODE,
      });
      expect(admin.error).toBeNull();

      const { data: rows } = await client
        .from("assignments")
        .select("room_id")
        .eq("participant_id", pid);
      expect(rows?.[0]?.room_id).toBe(roomB);
    } finally {
      await cleanup();
    }
  });
});
