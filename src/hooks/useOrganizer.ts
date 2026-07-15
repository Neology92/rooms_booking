import { useCallback, useEffect, useState } from "react";

// Stores the verified organizer passcode for a trip in localStorage. It is sent
// with every organizer RPC, where the server re-verifies it (see 0005). Full
// per-user accounts are a later upgrade (CLAUDE.md §7).
export function useOrganizer(tripId: string | undefined) {
  const key = tripId ? `rb_org:${tripId}` : null;
  const [passcode, setPasscode] = useState<string | null>(() =>
    key ? localStorage.getItem(key) : null,
  );

  useEffect(() => {
    setPasscode(key ? localStorage.getItem(key) : null);
  }, [key]);

  const save = useCallback(
    (value: string) => {
      if (!key) return;
      localStorage.setItem(key, value);
      setPasscode(value);
    },
    [key],
  );

  const clear = useCallback(() => {
    if (!key) return;
    localStorage.removeItem(key);
    setPasscode(null);
  }, [key]);

  return { passcode, save, clear };
}
