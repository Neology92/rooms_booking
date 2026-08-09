import { useMemo, useState } from "react";
import { useStrings } from "../i18n/I18nProvider";
import {
  endPairing,
  sendPairingRequest,
  sendSwapRequest,
  withdrawPairingRequest,
} from "../lib/actions";
import type { TripData } from "../hooks/useTripData";
import type { Participant } from "../types/domain";

// Negotiated roommate requests (DIRECTION.md). Deliberately separate from the
// manual "preferred person" picker so the two channels don't get confused.
export function PairingsPanel({ me, data }: { me: Participant; data: TripData }) {
  const t = useStrings().pairings;
  const { participants, assignments, pairings } = data;
  const [target, setTarget] = useState("");
  const [swapTarget, setSwapTarget] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const nameOf = (id: string) =>
    participants.find((p) => p.id === id)?.name ?? "?";
  const roomOf = (id: string) =>
    assignments.find((a) => a.participant_id === id)?.room_id ?? null;

  const mine = useMemo(
    () =>
      pairings.filter(
        (p) => p.from_participant_id === me.id || p.to_participant_id === me.id,
      ),
    [pairings, me.id],
  );
  const outgoing = mine.filter(
    (p) => p.status === "pending" && p.from_participant_id === me.id,
  );
  const accepted = mine.filter((p) => p.status === "accepted");

  // Anyone I already have an active (pending|accepted) relationship with is off
  // the send list — mirrors the server so PAIRING_EXISTS is rarely hit.
  const busyIds = new Set(
    mine
      .filter((p) => p.status === "pending" || p.status === "accepted")
      .map((p) =>
        p.from_participant_id === me.id
          ? p.to_participant_id
          : p.from_participant_id,
      ),
  );
  const candidates = participants.filter(
    (p) => p.id !== me.id && !busyIds.has(p.id),
  );
  // A realtime update can make the picked target "busy" before Send is clicked.
  // Derive validity so the blank-select case can't fire a guaranteed-fail send.
  const targetValid = target !== "" && candidates.some((c) => c.id === target);

  // Swap: only people assigned to a DIFFERENT room than me (and I must be in one).
  const myRoom = roomOf(me.id);
  const swapCandidates = participants.filter(
    (p) =>
      p.id !== me.id &&
      !busyIds.has(p.id) &&
      roomOf(p.id) !== null &&
      roomOf(p.id) !== myRoom,
  );
  const swapValid =
    myRoom !== null && swapTarget !== "" && swapCandidates.some((c) => c.id === swapTarget);

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) setError(res.error ?? "");
    return res;
  }

  function otherId(p: { from_participant_id: string; to_participant_id: string }) {
    return p.from_participant_id === me.id
      ? p.to_participant_id
      : p.from_participant_id;
  }

  return (
    <section className="rules-editor">
      <h2>{t.heading}</h2>
      <p className="muted">{t.intro}</p>
      {error && <p className="banner banner--error">{error}</p>}

      {accepted.length > 0 && (
        <div className="rule-block">
          {accepted.map((p) => {
            const oid = otherId(p);
            const together = roomOf(me.id) !== null && roomOf(me.id) === roomOf(oid);
            return (
              <div key={p.id} className="assign__row">
                <span className="assign__name">
                  <span className="tag tag--gender">{t.paired}</span>
                  {t.pairedWith(nameOf(oid))}
                  <span className="muted">
                    {" — "}
                    {together ? t.together : t.notTogether}
                  </span>
                </span>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() => act(() => endPairing(me.id, p.id))}
                >
                  {t.endPairing}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="rule-block">
          <strong>{t.outgoing}</strong>
          <ul className="assign">
            {outgoing.map((p) => (
              <li key={p.id} className="assign__row">
                <span className="assign__name">
                  {p.kind === "swap"
                    ? t.swapRequestedTo(nameOf(p.to_participant_id))
                    : t.requestedTo(nameOf(p.to_participant_id))}
                </span>
                <button
                  disabled={busy}
                  onClick={() => act(() => withdrawPairingRequest(me.id, p.id))}
                >
                  {t.withdraw}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rule-block">
        <label className="field">
          <span>{t.sendTo}</span>
          <select
            value={targetValid ? target : ""}
            disabled={busy || candidates.length === 0}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">{t.none}</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={busy || !targetValid}
          onClick={() =>
            act(async () => {
              const res = await sendPairingRequest(me.id, target);
              if (res.ok) setTarget("");
              return res;
            })
          }
        >
          {t.send}
        </button>
      </div>

      {myRoom !== null && (
        <div className="rule-block">
          <label className="field">
            <span>{t.swapSendTo}</span>
            <select
              value={swapValid ? swapTarget : ""}
              disabled={busy || swapCandidates.length === 0}
              onChange={(e) => setSwapTarget(e.target.value)}
            >
              <option value="">{t.swapNone}</option>
              {swapCandidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy || !swapValid}
            onClick={() =>
              act(async () => {
                const res = await sendSwapRequest(me.id, swapTarget);
                if (res.ok) setSwapTarget("");
                return res;
              })
            }
          >
            {t.swapSend}
          </button>
        </div>
      )}
    </section>
  );
}
