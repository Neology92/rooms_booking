import { useEffect, useState } from "react";
import { en } from "../i18n/strings";
import { supabase } from "../lib/supabase";
import { createTrip } from "../lib/actions";

const t = en.tripPicker;

interface TripRow {
  id: string;
  name: string;
  organizer_claimed: boolean;
}

// Landing screen when no trip is selected: list existing trips and create one.
// Creating a trip claims it, so the creator's passcode is handed back to be stored.
export function TripPicker({
  onSelect,
  onCreated,
}: {
  onSelect: (id: string) => void;
  onCreated: (id: string, passcode: string) => void;
}) {
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from("trips")
      .select("id, name, organizer_claimed")
      .order("created_at", { ascending: false })
      .then(({ data }) => setTrips(data ?? []));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const parsedTarget = target.trim() === "" ? null : Number(target);
    const res = await createTrip(name, parsedTarget, passcode);
    setBusy(false);
    if (res.ok && res.id) onCreated(res.id, passcode);
    else setError(res.error ?? "");
  }

  return (
    <section>
      <h2>{t.pickHeading}</h2>
      {trips.length === 0 ? (
        <p className="muted">{t.empty}</p>
      ) : (
        <ul className="assign">
          {trips.map((tr) => (
            <li key={tr.id} className="assign__row">
              <span className="assign__name">
                {tr.name}
                {tr.organizer_claimed && (
                  <span className="tag tag--gender">{t.organizerTag}</span>
                )}
              </span>
              <button onClick={() => onSelect(tr.id)}>{t.open}</button>
            </li>
          ))}
        </ul>
      )}

      <form className="onboarding" onSubmit={submit}>
        <h2>{t.createHeading}</h2>
        <p className="muted">{t.createIntro}</p>
        <label className="field">
          <span>{t.name}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          <span>{t.target}</span>
          <input
            type="number"
            min={1}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t.passcode}</span>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            required
          />
          <small className="muted">{t.passcodeHint}</small>
        </label>
        {error && <p className="banner banner--error">{error}</p>}
        <button type="submit" disabled={busy || name.trim() === "" || passcode.length < 4}>
          {t.create}
        </button>
      </form>
    </section>
  );
}
