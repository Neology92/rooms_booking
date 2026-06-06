import { useMemo, useState } from "react";
import { en } from "../i18n/strings";
import { joinRoom, leaveRoom } from "../lib/actions";
import type { TripData } from "../hooks/useTripData";
import type { Participant } from "../types/domain";

const t = en.participant;

export function ParticipantView({
  data,
  me,
  onReset,
}: {
  data: TripData;
  me: Participant;
  onReset: () => void;
}) {
  const { trip, rooms, participants, assignments } = data;
  const meId = me.id;
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const occupants = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of assignments) {
      const name = participants.find((p) => p.id === a.participant_id)?.name ?? "?";
      map.set(a.room_id, [...(map.get(a.room_id) ?? []), name]);
    }
    return map;
  }, [assignments, participants]);

  const myRoom = assignments.find((a) => a.participant_id === meId)?.room_id ?? null;
  const locked = trip?.signups_locked ?? false;

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    setBusy(true);
    const res = await fn();
    if (!res.ok) setError(res.error ?? "");
    setBusy(false);
  }

  return (
    <section>
      <div className="identity">
        <span>{en.onboarding.signedInAs(me.name)}</span>
        <button className="linklike" onClick={onReset}>
          {en.onboarding.notYou}
        </button>
      </div>

      {locked && <p className="banner banner--locked">{t.locked}</p>}
      {error && <p className="banner banner--error">{error}</p>}

      <h2>{t.rooms}</h2>
      <ul className="rooms">
        {rooms.map((room) => {
          const here = occupants.get(room.id) ?? [];
          const left = room.capacity - here.length;
          const mine = myRoom === room.id;
          const full = left <= 0 && !mine;
          return (
            <li key={room.id} className={`room ${mine ? "room--mine" : ""}`}>
              <div className="room__head">
                <strong>{room.name}</strong>
                <span className={full ? "tag tag--full" : "tag"}>
                  {full ? t.full : t.spotsLeft(left)}
                </span>
              </div>
              {room.info && <p className="room__info">{room.info}</p>}
              <p className="room__people">
                {here.length}/{room.capacity}
                {here.length > 0 && ` — ${here.join(", ")}`}
              </p>
              <div className="room__actions">
                {mine ? (
                  <>
                    <span className="here">{t.youAreHere}</span>
                    <button
                      disabled={busy || locked}
                      onClick={() => act(() => leaveRoom(meId))}
                    >
                      {t.leave}
                    </button>
                  </>
                ) : (
                  <button
                    disabled={busy || locked || full || !meId}
                    onClick={() => act(() => joinRoom(meId, room.id))}
                  >
                    {t.join}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
