import { useState } from "react";
import { useStrings } from "../i18n/I18nProvider";
import { respondPairingRequest } from "../lib/actions";
import type { TripData } from "../hooks/useTripData";
import type { Participant } from "../types/domain";

// Actionable incoming proposals, pinned at the TOP of the participant view so they
// can't be missed. Only Accept / Decline — you can't "ghost": the request stays
// visible (it lives in the DB) until you answer it. Renders nothing when there's
// nothing to respond to.
export function ProposalsBar({ me, data }: { me: Participant; data: TripData }) {
  const t = useStrings().pairings;
  const { participants, pairings } = data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const incoming = pairings.filter(
    (p) => p.status === "pending" && p.to_participant_id === me.id,
  );
  if (incoming.length === 0) return null;

  const nameOf = (id: string) =>
    participants.find((p) => p.id === id)?.name ?? "?";

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) setError(res.error ?? "");
  }

  return (
    <section className="proposals">
      <h2>{t.incoming}</h2>
      <ul className="assign">
        {incoming.map((p) => (
          <li key={p.id} className="assign__row">
            <span className="assign__name">
              {t.requestedBy(nameOf(p.from_participant_id))}
            </span>
            <span className="pairing__actions">
              <button
                disabled={busy}
                onClick={() => act(() => respondPairingRequest(me.id, p.id, true))}
              >
                {t.accept}
              </button>
              <button
                className="danger"
                disabled={busy}
                onClick={() => act(() => respondPairingRequest(me.id, p.id, false))}
              >
                {t.decline}
              </button>
            </span>
          </li>
        ))}
      </ul>
      {error && <p className="banner banner--error">{error}</p>}
    </section>
  );
}
