import { describe, it, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Integration tests for negotiated roommate requests against a real Supabase
// project (the active-pair unique index + advisory lock can only be proven
// against Postgres). Skipped without creds; see concurrency.integration.test.ts.
//   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run test:integration

declare const process: { env: Record<string, string | undefined> };

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const RUN = Boolean(url && key);
const client: SupabaseClient = RUN
  ? createClient(url as string, key as string)
  : (null as unknown as SupabaseClient);

const PASSCODE = "test-pass-1234";

async function newTrip() {
  const name = `PAIR ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

describe.skipIf(!RUN)("negotiated pairings (integration)", () => {
  it("send → accept establishes exactly one accepted pairing; duplicates rejected", async () => {
    const { tripId, cleanup } = await newTrip();
    try {
      const a = await addParticipant(tripId, "A");
      const b = await addParticipant(tripId, "B");

      const send = await client.rpc("send_pairing_request", { p_from: a, p_to: b });
      expect(send.error).toBeNull();
      const reqId = send.data as string;

      const dup = await client.rpc("send_pairing_request", { p_from: a, p_to: b });
      expect(dup.error?.message).toContain("PAIRING_EXISTS");

      // reverse while pending is also blocked (same unordered pair)
      const rev = await client.rpc("send_pairing_request", { p_from: b, p_to: a });
      expect(rev.error?.message).toContain("PAIRING_EXISTS");

      const accept = await client.rpc("respond_pairing_request", {
        p_participant_id: b,
        p_request_id: reqId,
        p_accept: true,
      });
      expect(accept.error).toBeNull();

      const { data: rows } = await client
        .from("pairing_requests")
        .select("status")
        .eq("trip_id", tripId)
        .in("status", ["pending", "accepted"]);
      expect(rows?.length).toBe(1);
      expect(rows?.[0]?.status).toBe("accepted");
    } finally {
      await cleanup();
    }
  });

  it("concurrent A→B and B→A collapse to a single active pairing", async () => {
    const { tripId, cleanup } = await newTrip();
    try {
      const a = await addParticipant(tripId, "A");
      const b = await addParticipant(tripId, "B");

      const [r1, r2] = await Promise.all([
        client.rpc("send_pairing_request", { p_from: a, p_to: b }),
        client.rpc("send_pairing_request", { p_from: b, p_to: a }),
      ]);

      const ok = [r1, r2].filter((r) => !r.error).length;
      const rejected = [r1, r2].filter((r) =>
        r.error?.message.includes("PAIRING_EXISTS"),
      ).length;
      expect(ok).toBe(1);
      expect(rejected).toBe(1);

      const { data: rows } = await client
        .from("pairing_requests")
        .select("id")
        .eq("trip_id", tripId)
        .in("status", ["pending", "accepted"]);
      expect(rows?.length).toBe(1);
    } finally {
      await cleanup();
    }
  });
});
