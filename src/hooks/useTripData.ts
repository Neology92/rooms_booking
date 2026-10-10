import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fetchMyPairings, fetchMyRules } from "../lib/actions";
import type {
  Assignment,
  PairingRequest,
  Participant,
  Room,
  Rule,
  Trip,
} from "../types/domain";

export interface TripData {
  trip: Trip | null;
  rooms: Room[];
  participants: Participant[];
  assignments: Assignment[];
  // Scoped to the signed-in participant (0015) — NOT the whole trip. The
  // organizer dashboard loads the trip-wide set separately, behind the passcode.
  rules: Rule[];
  pairings: PairingRequest[];
}

const empty: TripData = {
  trip: null,
  rooms: [],
  participants: [],
  assignments: [],
  rules: [],
  pairings: [],
};

// Incoming proposals can no longer arrive over Realtime: 0015 closed the public
// read on pairing_requests and Realtime honours RLS, so the anon client gets no
// events for that table. A light poll keeps the proposals bar fresh — one
// indexed RPC per tick, and only while the tab is actually visible.
const MINE_POLL_MS = 25_000;

// Loads one trip's public data (by id) and keeps it live via Supabase Realtime
// (NEEDS §4/§5): rooms, occupancy and names stay current for everyone. Private
// data (my rules, my pairings) comes from scoped RPCs and needs participantId.
// With no tripId, nothing loads (the trip picker shows).
export function useTripData(
  tripId: string | undefined,
  participantId?: string | null,
) {
  const [data, setData] = useState<TripData>(empty);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!supabase || !tripId) {
      setData(empty);
      setLoading(false);
      return;
    }
    // Explicit columns: never pull organizer_passcode_hash to the client.
    const { data: trips } = await supabase
      .from("trips")
      .select("id, name, target_headcount, signups_locked, organizer_claimed")
      .eq("id", tripId)
      .limit(1);
    const trip = trips?.[0] ?? null;
    if (!trip) {
      setData(empty);
      setLoading(false);
      return;
    }
    const [rooms, participants, assignments] = await Promise.all([
      supabase.from("rooms").select("*").eq("trip_id", trip.id).order("name"),
      supabase.from("participants").select("*").eq("trip_id", trip.id).order("name"),
      supabase.from("assignments").select("*").eq("trip_id", trip.id),
    ]);
    let rules: Rule[] = [];
    let pairings: PairingRequest[] = [];
    if (participantId) {
      [rules, pairings] = await Promise.all([
        fetchMyRules(participantId),
        fetchMyPairings(participantId),
      ]);
    }
    setData({
      trip,
      rooms: rooms.data ?? [],
      participants: participants.data ?? [],
      assignments: assignments.data ?? [],
      rules,
      pairings,
    });
    setLoading(false);
  }, [tripId, participantId]);

  // Cheap refresh of just my own proposals — no full reload, no flicker.
  const refreshMine = useCallback(async () => {
    if (!participantId) return;
    const mine = await fetchMyPairings(participantId);
    setData((prev) => (prev.trip ? { ...prev, pairings: mine } : prev));
  }, [participantId]);

  useEffect(() => {
    void load();
    const client = supabase;
    if (!client) return;
    // Only publicly readable tables are subscribed: rules and pairing_requests
    // would never deliver to an anon client after 0015 (see MINE_POLL_MS).
    const channel = client
      .channel("trip-data")
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, () => void load())
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [load]);

  useEffect(() => {
    if (!participantId) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refreshMine();
    };
    const id = window.setInterval(tick, MINE_POLL_MS);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, [participantId, refreshMine]);

  return { ...data, loading, reload: load, refreshMine };
}
