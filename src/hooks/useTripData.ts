import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
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

// Loads one trip's data (by id) and keeps it live via Supabase Realtime
// (NEEDS §4/§5). Any change to assignments/rooms/trips triggers a refetch so
// occupancy stays current. With no tripId, nothing loads (the trip picker shows).
export function useTripData(tripId: string | undefined) {
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
    const [rooms, participants, assignments, rules, pairings] = await Promise.all([
      supabase.from("rooms").select("*").eq("trip_id", trip.id).order("name"),
      supabase.from("participants").select("*").eq("trip_id", trip.id).order("name"),
      supabase.from("assignments").select("*").eq("trip_id", trip.id),
      supabase.from("rules").select("*"),
      supabase.from("pairing_requests").select("*").eq("trip_id", trip.id),
    ]);
    setData({
      trip,
      rooms: rooms.data ?? [],
      participants: participants.data ?? [],
      assignments: assignments.data ?? [],
      rules: rules.data ?? [],
      pairings: pairings.data ?? [],
    });
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    void load();
    const client = supabase;
    if (!client) return;
    const channel = client
      .channel("trip-data")
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "rules" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "pairing_requests" }, () => void load())
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [load]);

  return { ...data, loading, reload: load };
}
