import { describe, it, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare const process: { env: Record<string, string | undefined> };

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const RUN = Boolean(url && key);
const client: SupabaseClient = RUN
  ? createClient(url as string, key as string)
  : (null as unknown as SupabaseClient);

const PASS = "invite-pass-1234";

async function rpc(name: string, args: Record<string, unknown>) {
  return client.rpc(name, args);
}
async function newTrip() {
  const name = `INVITE ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
async function roomOf(pid: string) {
  const { data } = await client
    .from("assignments")
    .select("room_id")
    .eq("participant_id", pid);
  return data?.[0]?.room_id as string | undefined;
}

describe.skipIf(!RUN)("room invitations (integration)", () => {
  it("accepting an invite moves the invited person to the inviter's room", async () => {
    const { tripId, cleanup } = await newTrip();
    try {
      const a = await addRoom(tripId, "A", 3);
      const b = await addRoom(tripId, "B", 2);
      const p1 = await addParticipant(tripId, "Inviter");
      const p2 = await addParticipant(tripId, "Invited");
      await rpc("admin_assign", { p_participant_id: p1, p_room_id: a, p_passcode: PASS });
      await rpc("admin_assign", { p_participant_id: p2, p_room_id: b, p_passcode: PASS });

      const send = await rpc("send_room_invite", { p_from: p1, p_to: p2 });
      expect(send.error).toBeNull();
      const reqId = send.data as string;

      const ok = await rpc("respond_pairing_request", {
        p_participant_id: p2,
        p_request_id: reqId,
        p_accept: true,
      });
      expect(ok.error).toBeNull();

      expect(await roomOf(p2)).toBe(a);
      expect(await roomOf(p1)).toBe(a);

      const { data: row } = await client
        .from("pairing_requests")
        .select("status")
        .eq("id", reqId);
      expect(row?.[0]?.status).toBe("completed");
    } finally {
      await cleanup();
    }
  });

  it("invites an unassigned person into the inviter's room", async () => {
    const { tripId, cleanup } = await newTrip();
    try {
      const a = await addRoom(tripId, "A", 3);
      const p1 = await addParticipant(tripId, "Inviter");
      const p2 = await addParticipant(tripId, "Unassigned");
      await rpc("admin_assign", { p_participant_id: p1, p_room_id: a, p_passcode: PASS });

      const send = await rpc("send_room_invite", { p_from: p1, p_to: p2 });
      expect(send.error).toBeNull();
      const reqId = send.data as string;

      const ok = await rpc("respond_pairing_request", {
        p_participant_id: p2,
        p_request_id: reqId,
        p_accept: true,
      });
      expect(ok.error).toBeNull();

      expect(await roomOf(p2)).toBe(a);
    } finally {
      await cleanup();
    }
  });

  it("rejects invite when inviter's room is full", async () => {
    const { tripId, cleanup } = await newTrip();
    try {
      const a = await addRoom(tripId, "A", 1);
      const p1 = await addParticipant(tripId, "Inviter");
      const p2 = await addParticipant(tripId, "Invited");
      await rpc("admin_assign", { p_participant_id: p1, p_room_id: a, p_passcode: PASS });

      const send = await rpc("send_room_invite", { p_from: p1, p_to: p2 });
      expect(send.error).toBeNull();
      const reqId = send.data as string;

      const res = await rpc("respond_pairing_request", {
        p_participant_id: p2,
        p_request_id: reqId,
        p_accept: true,
      });
      expect(res.error?.message).toContain("ROOM_FULL");
      expect(await roomOf(p2)).toBeUndefined();
    } finally {
      await cleanup();
    }
  });

  it("blocks invite acceptance while sign-ups are locked", async () => {
    const { tripId, cleanup } = await newTrip();
    try {
      const a = await addRoom(tripId, "A", 3);
      const p1 = await addParticipant(tripId, "Inviter");
      const p2 = await addParticipant(tripId, "Invited");
      await rpc("admin_assign", { p_participant_id: p1, p_room_id: a, p_passcode: PASS });

      const send = await rpc("send_room_invite", { p_from: p1, p_to: p2 });
      const reqId = send.data as string;
      await rpc("set_signups_lock", { p_trip_id: tripId, p_locked: true, p_passcode: PASS });

      const res = await rpc("respond_pairing_request", {
        p_participant_id: p2,
        p_request_id: reqId,
        p_accept: true,
      });
      expect(res.error?.message).toContain("SIGNUPS_LOCKED");
      expect(await roomOf(p2)).toBeUndefined();
    } finally {
      await cleanup();
    }
  });

  it("rejects invite between people in the same room", async () => {
    const { tripId, cleanup } = await newTrip();
    try {
      const a = await addRoom(tripId, "A", 3);
      const p1 = await addParticipant(tripId, "P1");
      const p2 = await addParticipant(tripId, "P2");
      await rpc("admin_assign", { p_participant_id: p1, p_room_id: a, p_passcode: PASS });
      await rpc("admin_assign", { p_participant_id: p2, p_room_id: a, p_passcode: PASS });

      const send = await rpc("send_room_invite", { p_from: p1, p_to: p2 });
      expect(send.error?.message).toContain("SAME_ROOM");
    } finally {
      await cleanup();
    }
  });

  it("rejects invite when inviter is not assigned", async () => {
    const { tripId, cleanup } = await newTrip();
    try {
      await addRoom(tripId, "A", 3);
      const p1 = await addParticipant(tripId, "NotInRoom");
      const p2 = await addParticipant(tripId, "Target");

      const send = await rpc("send_room_invite", { p_from: p1, p_to: p2 });
      expect(send.error?.message).toContain("PARTICIPANT_NOT_ASSIGNED");
    } finally {
      await cleanup();
    }
  });

  it("declining an invite leaves the invited person in place", async () => {
    const { tripId, cleanup } = await newTrip();
    try {
      const a = await addRoom(tripId, "A", 3);
      const b = await addRoom(tripId, "B", 2);
      const p1 = await addParticipant(tripId, "Inviter");
      const p2 = await addParticipant(tripId, "Invited");
      await rpc("admin_assign", { p_participant_id: p1, p_room_id: a, p_passcode: PASS });
      await rpc("admin_assign", { p_participant_id: p2, p_room_id: b, p_passcode: PASS });

      const send = await rpc("send_room_invite", { p_from: p1, p_to: p2 });
      const reqId = send.data as string;

      const ok = await rpc("respond_pairing_request", {
        p_participant_id: p2,
        p_request_id: reqId,
        p_accept: false,
      });
      expect(ok.error).toBeNull();

      expect(await roomOf(p2)).toBe(b);

      const { data: row } = await client
        .from("pairing_requests")
        .select("status")
        .eq("id", reqId);
      expect(row?.[0]?.status).toBe("declined");
    } finally {
      await cleanup();
    }
  });
});
