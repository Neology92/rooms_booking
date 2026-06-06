import { useMemo, useState } from "react";
import { en } from "../i18n/strings";
import { setSignupsLock } from "../lib/actions";
import { splitBySeverity, tripStatus, unmetRules } from "../lib/rules";
import type { TripData } from "../hooks/useTripData";

const t = en.organizer;

export function OrganizerDashboard({ data }: { data: TripData }) {
  const { trip, rooms, participants, assignments, rules } = data;
  const [busy, setBusy] = useState(false);

  const nameOf = (id: string) =>
    participants.find((p) => p.id === id)?.name ?? "?";

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
