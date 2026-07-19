import { useState } from "react";
import { useStrings } from "../i18n/I18nProvider";
import { registerParticipant } from "../lib/actions";

export function Onboarding({
  tripId,
  onDone,
}: {
  tripId: string;
  onDone: (participantId: string) => void;
}) {
  const s = useStrings();
  const t = s.onboarding;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await registerParticipant(tripId, name, email, gender);
    setBusy(false);
    if (res.ok && res.id) onDone(res.id);
    else setError(res.error ?? "");
  }

  return (
    <form className="onboarding" onSubmit={submit}>
      <h2>{t.heading}</h2>
      <p className="muted">{t.intro}</p>

      <label className="field">
        <span>{t.name}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <label className="field">
        <span>{t.email}</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <small className="muted">{t.emailHint}</small>
      </label>

      <label className="field">
        <span>{t.gender}</span>
        <select value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">{t.genderUnset}</option>
          <option value="female">{t.female}</option>
          <option value="male">{t.male}</option>
          <option value="other">{t.other}</option>
        </select>
      </label>

      {error && <p className="banner banner--error">{error}</p>}

      <button type="submit" disabled={busy || name.trim().length === 0}>
        {t.submit}
      </button>
    </form>
  );
}
