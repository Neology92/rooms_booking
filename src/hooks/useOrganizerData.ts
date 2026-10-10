import { useCallback, useEffect, useState } from "react";
import { fetchTripPairings, fetchTripRules } from "../lib/actions";
import type { PairingRequest, Rule } from "../types/domain";

// Trip-wide preferences, readable only with a verified organizer passcode (0015).
// Deliberately kept OUT of useTripData: the bundle a participant loads must never
// carry everyone's rules. A failed read surfaces `error`, so the dashboard can
// bounce back to the sign-in form when a stored passcode has gone stale.
// `reloadKey` lets the caller re-pull when something it can see changes (e.g. a
// participant joined a room): trip-wide pairings no longer arrive over Realtime
// after 0015, so the issues panel would otherwise drift out of date.
export function useOrganizerData(
  tripId: string | undefined,
  passcode: string | null,
  reloadKey?: string,
) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [pairings, setPairings] = useState<PairingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!tripId || !passcode) {
      setRules([]);
      setPairings([]);
      setError("");
      return;
    }
    setLoading(true);
    const [r, p] = await Promise.all([
      fetchTripRules(tripId, passcode),
      fetchTripPairings(tripId, passcode),
    ]);
    setLoading(false);
    if (!r.ok || !p.ok) {
      setRules([]);
      setPairings([]);
      setError(r.error ?? p.error ?? "");
      return;
    }
    setError("");
    setRules(r.rows);
    setPairings(p.rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, passcode, reloadKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rules, pairings, loading, error, reload: load };
}
