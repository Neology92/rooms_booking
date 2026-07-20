import { useMemo, useState } from "react";
import {
  adminAssign,
  adminDeleteTrip,
  adminSetTarget,
  adminSwap,
  adminUnassign,
  setSignupsLock,
} from "../lib/actions";
import { effectiveRules, splitBySeverity, tripStatus, unmetRules } from "../lib/rules";
import { optimize, type OptimizeResult } from "../lib/optimize";
import { useStrings } from "../i18n/I18nProvider";
import { OrganizerAuth } from "../components/OrganizerAuth";
import { RoomsEditor } from "../components/RoomsEditor";
import type { TripData } from "../hooks/useTripData";

export function OrganizerDashboard({
  data,
  passcode,
  onAuthed,
  onSignOut,
  onReload,
  onDeleted,
}: {
  data: TripData;
  passcode: string | null;
  onAuthed: (passcode: string) => void;
  onSignOut: () => void;
  onReload: () => void;
  onDeleted: () => void;
}) {
  const s = useStrings();
  const t = s.organizer;
  const { trip, rooms, participants, assignments, rules, pairings } = data;

  // Accepted negotiated pairings fold in as synthetic two-way soft preferences,
  // so signalling + the optimizer honor them without touching the rules engine.
  const eff = useMemo(
    () => effectiveRules(rules, pairings, participants),
    [rules, pairings, participants],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [opt, setOpt] = useState<OptimizeResult | null>(null);
  const [targetDraft, setTargetDraft] = useState(
    trip?.target_headcount != null ? String(trip.target_headcount) : "",
  );
  const authed = passcode !== null;

  const nameOf = (id: string) =>
    participants.find((p) => p.id === id)?.name ?? "?";

  const roomNameOf = (participantId: string) => {
    const roomId = assignments.find((x) => x.participant_id === participantId)?.room_id;
    return rooms.find((r) => r.id === roomId)?.name ?? "?";
  };

  const roomOf = (participantId: string) =>
    assignments.find((a) => a.participant_id === participantId)?.room_id ?? "";

  const fillOf = (roomId: string) =>
    assignments.filter((a) => a.room_id === roomId).length;

  // Run an organizer action; a stale passcode (NOT_ORGANIZER) drops us back to
  // the sign-in panel so the organizer can re-enter it.
  async function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "");
      if (res.error === s.errors.NOT_ORGANIZER) onSignOut();
    }
  }

  const unmet = useMemo(
    () => unmetRules(eff, assignments, participants),
    [eff, assignments, participants],
  );
  const { critical, preferences } = splitBySeverity(unmet);
  const signedUp = assignments.length;
  const status = tripStatus(signedUp, trip?.target_headcount ?? null, critical.length);

  if (!trip) return null;
  const tripId = trip.id;

  return (
    <section>
      <div className={`status status--${status}`}>
        <div>
          <span className="status__label">{t.signedUp}</span>
          <span className="status__value">
            {signedUp}
            {trip.target_headcount != null && ` / ${trip.target_headcount}`}
          </span>
        </div>
        {authed && (
          <button
            onClick={() =>
              act(() => setSignupsLock(tripId, !trip.signups_locked, passcode))
            }
            disabled={busy}
          >
            {trip.signups_locked ? t.unlockSignups : t.lockSignups}
          </button>
        )}
        <span className={`tag ${trip.signups_locked ? "tag--full" : ""}`}>
          {trip.signups_locked ? t.locked : t.open}
        </span>
        {authed && (
          <button className="linklike" onClick={onSignOut}>
            {t.signOut}
          </button>
        )}
      </div>

      <h2>{t.occupancy}</h2>
      <ul className="rooms">
        {rooms.map((room) => {
          const here = assignments.filter((a) => a.room_id === room.id);
          return (
            <li key={room.id} className="room">
              <div className="room__head">
                <strong>{room.name}</strong>
                <span className="tag">
                  {here.length}/{room.capacity}
                </span>
              </div>
              <p className="room__people">
                {here.map((a) => nameOf(a.participant_id)).join(", ") || "—"}
              </p>
            </li>
          );
        })}
      </ul>

      {!authed ? (
        <OrganizerAuth
          tripId={tripId}
          claimed={trip.organizer_claimed}
          onAuthed={onAuthed}
          onClaimed={onReload}
        />
      ) : (
        <>
          {error && <p className="banner banner--error">{error}</p>}

          <RoomsEditor
            tripId={tripId}
            rooms={rooms}
            assignments={assignments}
            passcode={passcode}
            onError={setError}
          />

          <div className="target-form">
            <label className="field">
              <span>{s.rooms.target}</span>
              <input
                type="number"
                min={1}
                value={targetDraft}
                onChange={(e) => setTargetDraft(e.target.value)}
              />
            </label>
            <button
              disabled={busy}
              onClick={() =>
                act(() =>
                  adminSetTarget(
                    tripId,
                    targetDraft.trim() === "" ? null : Number(targetDraft),
                    passcode,
                  ),
                )
              }
            >
              {s.rooms.saveTarget}
            </button>
          </div>

          <h2>{t.manage}</h2>
          <p className="muted">{t.manageIntro}</p>
          {participants.length === 0 ? (
            <p className="muted">{t.noParticipants}</p>
          ) : (
            <ul className="assign">
              {participants.map((p) => {
                const current = roomOf(p.id);
                return (
                  <li key={p.id} className="assign__row">
                    <span className="assign__name">
                      {p.name}
                      {p.gender && (
                        <span className="tag tag--gender">{p.gender}</span>
                      )}
                    </span>
                    <select
                      value={current}
                      disabled={busy}
                      onChange={(e) =>
                        act(() =>
                          e.target.value
                            ? adminAssign(p.id, e.target.value, passcode)
                            : adminUnassign(p.id, passcode),
                        )
                      }
                    >
                      <option value="">{t.unassigned}</option>
                      {rooms.map((room) => {
                        const count = fillOf(room.id);
                        const isCurrent = current === room.id;
                        const full = count >= room.capacity && !isCurrent;
                        return (
                          <option key={room.id} value={room.id} disabled={full}>
                            {full
                              ? t.roomFullOption(room.name)
                              : `${room.name} (${count}/${room.capacity})`}
                          </option>
                        );
                      })}
                    </select>
                  </li>
                );
              })}
            </ul>
          )}

          <h2>{t.optimize}</h2>
          <p className="muted">{t.optimizeIntro}</p>
          <button
            disabled={busy}
            onClick={() => setOpt(optimize(participants, assignments, eff))}
          >
            {t.optimizeRun}
          </button>
          {opt && opt.proposals.length === 0 && (
            <p className="banner banner--ok">{t.optimizeNone}</p>
          )}
          {opt && opt.proposals.length > 0 && (
            <>
              <p className="muted">
                {t.optimizeSummary(
                  opt.before.critical - opt.after.critical,
                  opt.before.preferences - opt.after.preferences,
                )}
              </p>
              <ul className="assign">
                {opt.proposals.map((s, i) => (
                  <li key={`${s.aId}-${s.bId}-${i}`} className="assign__row">
                    <span className="assign__name">
                      {t.swapWith(
                        nameOf(s.aId),
                        roomNameOf(s.aId),
                        nameOf(s.bId),
                        roomNameOf(s.bId),
                      )}
                    </span>
                    <button
                      disabled={busy}
                      onClick={() =>
                        act(async () => {
                          const res = await adminSwap(s.aId, s.bId, passcode);
                          if (res.ok) setOpt(null); // stale after the swap
                          return res;
                        })
                      }
                    >
                      {t.apply}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="danger-zone">
            <h2>{t.dangerZone}</h2>
            <button
              className="danger"
              disabled={busy}
              onClick={() => {
                if (!window.confirm(t.deleteConfirm(trip.name))) return;
                void act(async () => {
                  const res = await adminDeleteTrip(tripId, passcode);
                  if (res.ok) onDeleted();
                  return res;
                });
              }}
            >
              {t.deleteTrip}
            </button>
          </div>
        </>
      )}

      <h2>{t.issues}</h2>
      {critical.length === 0 && preferences.length === 0 ? (
        <p className="banner banner--ok">{t.allGood}</p>
      ) : (
        <ul className="issues">
          {critical.map((u) => (
            <li key={u.rule.id} className="issue issue--critical">
              <strong>{t.mustHaveViolation}:</strong> {nameOf(u.participantId)} —{" "}
              {describe(u.rule.type, u.rule.target_participant_id, nameOf)}
            </li>
          ))}
          {preferences.map((u) => (
            <li key={u.rule.id} className="issue issue--pref">
              <strong>{t.preferenceUnmet}:</strong> {nameOf(u.participantId)} —{" "}
              {describe(u.rule.type, u.rule.target_participant_id, nameOf)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function describe(
  type: string,
  target: string | null,
  nameOf: (id: string) => string,
): string {
  if (type === "same_gender") return "same-gender room";
  if (type === "preferred_person" && target) return `wants to be with ${nameOf(target)}`;
  return type;
}
