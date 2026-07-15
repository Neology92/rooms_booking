import { useMemo, useState } from "react";
import { en } from "../i18n/strings";
import { adminAssign, adminUnassign, setSignupsLock } from "../lib/actions";
import { splitBySeverity, tripStatus, unmetRules } from "../lib/rules";
import type { TripData } from "../hooks/useTripData";

const t = en.organizer;

export function OrganizerDashboard({ data }: { data: TripData }) {
  const { trip, rooms, participants, assignments, rules } = data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const nameOf = (id: string) =>
    participants.find((p) => p.id === id)?.name ?? "?";

  const roomOf = (participantId: string) =>
    assignments.find((a) => a.participant_id === participantId)?.room_id ?? "";

  const fillOf = (roomId: string) =>
    assignments.filter((a) => a.room_id === roomId).length;

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    setBusy(true);
    const res = await fn();
    if (!res.ok) setError(res.error ?? "");
    setBusy(false);
  }

  const unmet = useMemo(
    () => unmetRules(rules, assignments, participants),
    [rules, assignments, participants],
  );
  const { critical, preferences } = splitBySeverity(unmet);
  const signedUp = assignments.length;
  const status = tripStatus(signedUp, trip?.target_headcount ?? null, critical.length);

  if (!trip) return null;

  async function toggleLock() {
    if (!trip) return;
    setBusy(true);
    await setSignupsLock(trip.id, !trip.signups_locked);
    setBusy(false);
  }

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
        <button onClick={toggleLock} disabled={busy}>
          {trip.signups_locked ? t.unlockSignups : t.lockSignups}
        </button>
        <span className={`tag ${trip.signups_locked ? "tag--full" : ""}`}>
          {trip.signups_locked ? t.locked : t.open}
        </span>
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

      <h2>{t.manage}</h2>
      <p className="muted">{t.manageIntro}</p>
      {error && <p className="banner banner--error">{error}</p>}
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
                  {p.gender && <span className="tag tag--gender">{p.gender}</span>}
                </span>
                <select
                  value={current}
                  disabled={busy}
                  onChange={(e) =>
                    act(() =>
                      e.target.value
                        ? adminAssign(p.id, e.target.value)
                        : adminUnassign(p.id),
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
