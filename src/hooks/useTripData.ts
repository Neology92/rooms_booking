import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type {
  Assignment,
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
}

const empty: TripData = {
  trip: null,
  rooms: [],
  participants: [],
  assignments: [],
  rules: [],
};

// Loads a single trip's data and keeps it live via Supabase Realtime (NEEDS §4/§5).
// Any change to assignments/rooms/trips triggers a refetch so occupancy stays current.
export function useTripData() {
  const [data, setData] = useState<TripData>(empty);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data: trips } = await supabase.from("trips").select("*").limit(1);
    const trip = trips?.[0] ?? null;
    if (!trip) {
      setData(empty);
      setLoading(false);
      return;
    }
    const [rooms, participants, assignments, rules] = await Promise.all([
      supabase.from("rooms").select("*").eq("trip_id", trip.id).order("name"),
      supabase.from("participants").select("*").eq("trip_id", trip.id).order("name"),
      supabase.from("assignments").select("*").eq("trip_id", trip.id),
      supabase.from("rules").select("*"),
    ]);
    setData({
      trip,
      rooms: rooms.data ?? [],
      participants: participants.data ?? [],
      assignments: assignments.data ?? [],
      rules: rules.data ?? [],
    });
    setLoading(false);
  }, []);

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
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [load]);

  return { ...data, loading, reload: load };
}
