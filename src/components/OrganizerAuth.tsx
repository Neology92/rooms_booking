import { useState } from "react";
import { en } from "../i18n/strings";
import { setOrganizerPasscode, verifyOrganizer } from "../lib/actions";

const t = en.organizerAuth;

// Shown in the Organizer tab when the visitor hasn't unlocked controls.
// - Unclaimed trip  -> set a passcode (claim).
// - Claimed trip    -> enter the passcode (verify).
// On success, hands the passcode up so it can be stored and sent with RPCs.
export function OrganizerAuth({
  tripId,
  claimed,
  onAuthed,
  onClaimed,
}: {
  tripId: string;
  claimed: boolean;
  onAuthed: (passcode: string) => void;
  onClaimed: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    if (claimed) {
      const res = await verifyOrganizer(tripId, value);
      setBusy(false);
      if (res.ok && res.valid) onAuthed(value);
      else setError(res.error ?? en.errors.NOT_ORGANIZER);
    } else {
      const res = await setOrganizerPasscode(tripId, "", value);
      setBusy(false);
      if (res.ok) {
        onAuthed(value);
        onClaimed();
      } else {
        setError(res.error ?? "");
      }
    }
  }

  return (
    <form className="onboarding" onSubmit={submit}>
      <h2>{claimed ? t.loginHeading : t.claimHeading}</h2>
      <p className="muted">{claimed ? t.loginIntro : t.claimIntro}</p>
      <label className="field">
        <span>{t.passcode}</span>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
      </label>
      {error && <p className="banner banner--error">{error}</p>}
      <button type="submit" disabled={busy || value.length === 0}>
        {claimed ? t.loginSubmit : t.claimSubmit}
      </button>
    </form>
  );
}
