import { useCallback, useEffect, useState } from "react";

// Remembers "who am I" for a trip in localStorage so a participant returns as
// themselves without logging in (full auth is Phase 4). Keyed per trip.
export function useIdentity(tripId: string | undefined) {
  const key = tripId ? `rb_participant:${tripId}` : null;
  const [id, setId] = useState<string | null>(() =>
    key ? localStorage.getItem(key) : null,
  );

  useEffect(() => {
    setId(key ? localStorage.getItem(key) : null);
  }, [key]);

  const save = useCallback(
    (participantId: string) => {
      if (!key) return;
      localStorage.setItem(key, participantId);
      setId(participantId);
    },
    [key],
  );

  const clear = useCallback(() => {
    if (!key) return;
    localStorage.removeItem(key);
    setId(null);
  }, [key]);

  return { id, save, clear };
}
