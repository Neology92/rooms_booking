import { useState } from "react";
import { useStrings } from "../i18n/I18nProvider";
import { respondPairingRequest } from "../lib/actions";
import type { TripData } from "../hooks/useTripData";
import type { Participant, PairingKind } from "../types/domain";

// Actionable incoming proposals, pinned at the TOP of the participant view so they
// can't be missed. Only Accept / Decline — you can't "ghost": the request stays
// visible (it lives in the DB) until you answer it. Renders nothing when there's
// nothing to respond to.
//
// Swap and invite acceptance MOVES the recipient to another room, unlike a pair
// request (soft preference) — so each row carries a kind tag and a consequence
// line naming the room you'd end up in, before you commit.
export function ProposalsBar({ me, data }: { me: Participant; data: TripData }) {
  const t = useStrings().pairings;
  const { participants, pairings, assignments, rooms } = data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const incoming = pairings.filter(
    (p) => p.status === "pending" && p.to_participant_id === me.id,
  );
  if (incoming.length === 0) return null;

  const nameOf = (id: string) =>
    participants.find((p) => p.id === id)?.name ?? "?";
  const roomNameOf = (participantId: string): string | null => {
    const roomId = assignments.find(
      (a) => a.participant_id === participantId,
    )?.room_id;
    return rooms.find((r) => r.id === roomId)?.name ?? null;
  };

  const kindTag: Record<PairingKind, { label: string; cls: string }> = {
    pair: { label: t.kindPair, cls: "tag--pair" },
    swap: { label: t.kindSwap, cls: "tag--move" },
    invite: { label: t.kindInvite, cls: "tag--move" },
  };

  // What accepting does, from the recipient's point of view. For swap/invite the
  // destination is the SENDER's current room; if the sender has since left their
  // room the accept will fail server-side, so we just omit the line.
  function consequence(kind: PairingKind, fromId: string): string | null {
    if (kind === "pair") return t.pairConsequence;
    const room = roomNameOf(fromId);
    if (!room) return null;
    return kind === "swap" ? t.swapConsequence(room) : t.inviteConsequence(room);
  }

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
        {incoming.map((p) => {
          const detail = consequence(p.kind, p.from_participant_id);
          return (
            <li key={p.id} className="assign__row">
              <span className="assign__name proposal__body">
                <span>
                  <span className={`tag ${kindTag[p.kind].cls}`}>
                    {kindTag[p.kind].label}
                  </span>{" "}
                  {p.kind === "invite"
                    ? t.inviteRequestedBy(nameOf(p.from_participant_id))
                    : p.kind === "swap"
                      ? t.swapRequestedBy(nameOf(p.from_participant_id))
                      : t.requestedBy(nameOf(p.from_participant_id))}
                </span>
                {detail && <span className="proposal__detail">{detail}</span>}
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
          );
        })}
      </ul>
      {error && <p className="banner banner--error">{error}</p>}
    </section>
  );
}
