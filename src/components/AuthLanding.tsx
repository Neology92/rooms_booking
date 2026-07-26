import { useState } from "react";
import { useStrings } from "../i18n/I18nProvider";
import { requestPasswordReset, signIn, signUp } from "../lib/auth";

type Mode = "signin" | "signup" | "reset";

// v2 accounts entry. Non-blocking during rollout: the rest of the app still works
// without a session; this just lets a user create/sign into an account.
export function AuthLanding({ onDone }: { onDone: () => void }) {
  const t = useStrings().auth;
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    if (mode === "signin") {
      const res = await signIn(email, password);
      setBusy(false);
      if (res.ok) onDone();
      else setError(res.error ?? "");
    } else if (mode === "signup") {
      const res = await signUp(email, password, name);
      setBusy(false);
      if (!res.ok) setError(res.error ?? "");
      else if (res.needsConfirm) setNotice(t.needConfirm);
      else onDone();
    } else {
      const res = await requestPasswordReset(email);
      setBusy(false);
      if (res.ok) setNotice(t.resetSent);
      else setError(res.error ?? "");
    }
  }

  return (
    <section className="onboarding">
      <h2>
        {mode === "signin" ? t.signIn : mode === "signup" ? t.signUp : t.resetHeading}
      </h2>
      <p className="muted">{t.rolloutNote}</p>

      <form className="onboarding" onSubmit={submit}>
        {mode === "signup" && (
          <label className="field">
            <span>{t.name}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        )}
        <label className="field">
          <span>{t.email}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        {mode !== "reset" && (
          <label className="field">
            <span>{t.password}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
        )}

        {error && <p className="banner banner--error">{error}</p>}
        {notice && <p className="banner banner--ok">{notice}</p>}

        <button type="submit" disabled={busy}>
          {mode === "signin"
            ? t.signInSubmit
            : mode === "signup"
              ? t.signUpSubmit
              : t.resetSubmit}
        </button>
      </form>

      <div className="auth__links">
        {mode === "signin" && (
          <>
            <button className="linklike" onClick={() => setMode("signup")}>
              {t.noAccount}
            </button>
            <button className="linklike" onClick={() => setMode("reset")}>
              {t.forgot}
            </button>
          </>
        )}
        {mode === "signup" && (
          <button className="linklike" onClick={() => setMode("signin")}>
            {t.haveAccount}
          </button>
        )}
        {mode === "reset" && (
          <button className="linklike" onClick={() => setMode("signin")}>
            {t.back}
          </button>
        )}
      </div>
    </section>
  );
}
