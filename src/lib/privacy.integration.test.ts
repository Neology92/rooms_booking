import { describe, it, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Integration tests for the preference-privacy boundary (0015) against a real
// Supabase project, using the ANON key — i.e. exactly the access a visitor has.
// Skipped without creds; see concurrency.integration.test.ts.
//   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run test:integration

declare const process: { env: Record<string, string | undefined> };

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const RUN = Boolean(url && key);
const client: SupabaseClient = RUN
  ? createClient(url as string, key as string)
  : (null as unknown as SupabaseClient);

const PASS = "priv-pass-1234";

async function rpc(name: string, args: Record<string, unknown>) {
  return client.rpc(name, args);
}
async function newTrip() {
  const name = `PRIV ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

describe.skipIf(!RUN)("preference privacy (integration)", () => {
  it("hides everyone's rules and pairings from a plain anon read", async () => {
    const { tripId, cleanup } = await newTrip();
    try {
      const p1 = await addParticipant(tripId, "P1");
      const p2 = await addParticipant(tripId, "P2");
      const p3 = await addParticipant(tripId, "Bystander");

      await rpc("set_rule", {
        p_participant_id: p1,
        p_type: "preferred_person",
        p_strictness: "preference",
        p_target_participant_id: p2,
      });
      const sent = await rpc("send_pairing_request", { p_from: p1, p_to: p2 });
      expect(sent.error).toBeNull();

      // Direct table reads must come back empty: RLS has no SELECT policy now.
      const rules = await client.from("rules").select("*");
      expect(rules.data ?? []).toHaveLength(0);
      const pairings = await client
        .from("pairing_requests")
        .select("*")
        .eq("trip_id", tripId);
      expect(pairings.data ?? []).toHaveLength(0);

      // …while the owner still reaches their own rows through the scoped RPCs.
      const mine = await rpc("get_my_rules", { p_participant_id: p1 });
      expect(mine.error).toBeNull();
      expect(mine.data as unknown[]).toHaveLength(1);

      const minePairs = await rpc("get_my_pairings", { p_participant_id: p1 });
      expect(minePairs.error).toBeNull();
      expect(minePairs.data as unknown[]).toHaveLength(1);

      // The recipient sees it too (either direction counts).
      const theirs = await rpc("get_my_pairings", { p_participant_id: p2 });
      expect(theirs.data as unknown[]).toHaveLength(1);

      // An uninvolved participant sees nothing.
      const bystander = await rpc("get_my_pairings", { p_participant_id: p3 });
      expect(bystander.data as unknown[]).toHaveLength(0);
      const bystanderRules = await rpc("get_my_rules", { p_participant_id: p3 });
      expect(bystanderRules.data as unknown[]).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  it("gives the organizer the whole trip, but only with the right passcode", async () => {
    const { tripId, cleanup } = await newTrip();
    try {
      const p1 = await addParticipant(tripId, "P1");
      const p2 = await addParticipant(tripId, "P2");
      await rpc("set_rule", {
        p_participant_id: p1,
        p_type: "same_gender",
        p_strictness: "must_have",
        p_target_participant_id: null,
      });
      await rpc("set_rule", {
        p_participant_id: p2,
        p_type: "preferred_person",
        p_strictness: "preference",
        p_target_participant_id: p1,
      });
      await rpc("send_pairing_request", { p_from: p1, p_to: p2 });

      const ok = await rpc("get_trip_rules", { p_trip_id: tripId, p_passcode: PASS });
      expect(ok.error).toBeNull();
      expect(ok.data as unknown[]).toHaveLength(2);

      const okPairs = await rpc("get_trip_pairings", {
        p_trip_id: tripId,
        p_passcode: PASS,
      });
      expect(okPairs.error).toBeNull();
      expect(okPairs.data as unknown[]).toHaveLength(1);

      const bad = await rpc("get_trip_rules", {
        p_trip_id: tripId,
        p_passcode: "definitely-wrong",
      });
      expect(bad.error?.message).toContain("NOT_ORGANIZER");

      const badPairs = await rpc("get_trip_pairings", {
        p_trip_id: tripId,
        p_passcode: "definitely-wrong",
      });
      expect(badPairs.error?.message).toContain("NOT_ORGANIZER");
    } finally {
      await cleanup();
    }
  });
});
