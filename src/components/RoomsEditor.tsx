import { useState } from "react";
import { useStrings } from "../i18n/I18nProvider";
import {
  adminCreateRoom,
  adminDeleteRoom,
  adminUpdateRoom,
} from "../lib/actions";
import type { Assignment, Room } from "../types/domain";

type Result = { ok: boolean; error?: string };

export function RoomsEditor({
  tripId,
  rooms,
  assignments,
  passcode,
  onError,
}: {
  tripId: string;
  rooms: Room[];
  assignments: Assignment[];
  passcode: string;
  onError: (msg: string) => void;
}) {
  const t = useStrings().rooms;
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("2");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const fillOf = (roomId: string) =>
    assignments.filter((a) => a.room_id === roomId).length;

  async function run(fn: () => Promise<Result>) {
    onError("");
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) onError(res.error ?? "");
    return res;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await run(() =>
      adminCreateRoom(tripId, name, Number(capacity), info, passcode),
    );
    if (res.ok) {
      setName("");
      setCapacity("2");
      setInfo("");
    }
  }

  return (
    <div>
      <h2>{t.heading}</h2>
      <p className="muted">{t.intro}</p>

      <ul className="assign">
        {rooms.map((room) => (
          <RoomRow
            key={room.id}
            room={room}
            occupied={fillOf(room.id)}
            busy={busy}
            passcode={passcode}
            run={run}
          />
        ))}
      </ul>

      <form className="room-form" onSubmit={add}>
        <input
          aria-label={t.name}
          placeholder={t.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          aria-label={t.capacity}
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          required
        />
        <input
          aria-label={t.info}
          placeholder={t.info}
          value={info}
          onChange={(e) => setInfo(e.target.value)}
        />
        <button type="submit" disabled={busy || name.trim() === ""}>
          {t.add}
        </button>
      </form>
    </div>
  );
}

// Local draft state so edits don't fight realtime refreshes; remounts (key=id)
// pick up external changes.
function RoomRow({
  room,
  occupied,
  busy,
  passcode,
  run,
}: {
  room: Room;
  occupied: number;
  busy: boolean;
  passcode: string;
  run: (fn: () => Promise<Result>) => Promise<Result>;
}) {
  const t = useStrings().rooms;
  const [name, setName] = useState(room.name);
  const [capacity, setCapacity] = useState(String(room.capacity));
  const [info, setInfo] = useState(room.info ?? "");

  return (
    <li className="room-form room-form--row">
      <input
        aria-label={t.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        aria-label={t.capacity}
        type="number"
        min={1}
        value={capacity}
        onChange={(e) => setCapacity(e.target.value)}
        required
      />
      <input
        aria-label={t.info}
        placeholder={t.info}
        value={info}
        onChange={(e) => setInfo(e.target.value)}
      />
      <span className="muted">{t.occupied(occupied)}</span>
      <button
        disabled={busy || name.trim() === ""}
        onClick={() =>
          run(() =>
            adminUpdateRoom(room.id, name, Number(capacity), info, passcode),
          )
        }
      >
        {t.save}
      </button>
      <button
        className="danger"
        disabled={busy || occupied > 0}
        onClick={() => run(() => adminDeleteRoom(room.id, passcode))}
      >
        {t.remove}
      </button>
    </li>
  );
}
