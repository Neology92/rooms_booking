import { useCallback, useEffect, useState } from "react";

// The selected trip lives in the URL (?trip=<id>) so a trip is shareable by link
// and survives refreshes. No router dependency — just the History API.
function readTripId(): string | undefined {
  return new URLSearchParams(window.location.search).get("trip") ?? undefined;
}

export function useTripId() {
  const [tripId, setTripId] = useState<string | undefined>(readTripId);

  const select = useCallback((id: string | undefined) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("trip", id);
    else url.searchParams.delete("trip");
    window.history.pushState({}, "", url);
    setTripId(id);
  }, []);

  useEffect(() => {
    const onPop = () => setTripId(readTripId());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return { tripId, select };
}
