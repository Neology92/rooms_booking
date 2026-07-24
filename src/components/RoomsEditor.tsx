import { useRef, useState } from "react";
import { useStrings } from "../i18n/I18nProvider";
import {
  adminCreateRoom,
  adminDeleteRoom,
  adminUpdateRoom,
} from "../lib/actions";
import type { Assignment, Room } from "../types/domain";

type Result = { ok: boolean; error?: string };
interface Draft {
  name: string;
  capacity: number;
  info: string;
}

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
  const [qty, setQty] = useState("1");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

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

  // Queue rooms locally (instant, no round-trip). Quantity > 1 numbers them.
  function addToList(e: React.FormEvent) {
    e.preventDefault();
    const base = name.trim();
    if (base === "") return;
    const cap = Math.max(1, Number(capacity) || 1);
    const count = Math.min(50, Math.max(1, Number(qty) || 1));
    const next: Draft[] = [];
    for (let i = 0; i < count; i++) {
      next.push({ name: count > 1 ? `${base} ${i + 1}` : base, capacity: cap, info: info.trim() });
    }
    setDrafts((d) => [...d, ...next]);
    setName("");
    setInfo("");
    setQty("1");
    nameRef.current?.focus();
  }

  // Create every queued room in one batch; keep any that fail so they can retry.
  async function createAll() {
    onError("");
    setBusy(true);
    const results = await Promise.all(
      drafts.map((d) => adminCreateRoom(tripId, d.name, d.capacity, d.info, passcode)),
    );
    setBusy(false);
    const remaining = drafts.filter((_, i) => !results[i].ok);
    setDrafts(remaining);
    const firstErr = results.find((r) => !r.ok);
    if (firstErr) onError(firstErr.error ?? "");
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

      <form className="room-form" onSubmit={addToList}>
        <input
          ref={nameRef}
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
        <input
          aria-label={t.quantity}
          title={t.quantity}
          type="number"
          min={1}
          max={50}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <button type="submit" disabled={name.trim() === ""}>
          {t.add}
        </button>
      </form>

      {drafts.length > 0 && (
        <div className="drafts">
          <ul className="assign">
            {drafts.map((d, i) => (
              <li key={i} className="assign__row">
                <span className="assign__name">
                  {d.name} · {d.capacity}
                  {d.info ? ` · ${d.info}` : ""}
                </span>
                <button
                  className="linklike"
                  disabled={busy}
                  onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))}
                >
                  {t.remove}
                </button>
              </li>
            ))}
          </ul>
          <button disabled={busy} onClick={createAll}>
            {t.createQueued(drafts.length)}
          </button>
        </div>
      )}
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
