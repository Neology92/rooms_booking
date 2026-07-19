import { useMemo, useState } from "react";
import { useStrings } from "../i18n/I18nProvider";
import { clearRule, setRule } from "../lib/actions";
import { unmetRules } from "../lib/rules";
import type { TripData } from "../hooks/useTripData";
import type { Participant, RuleStrictness } from "../types/domain";

export function RulesEditor({ me, data }: { me: Participant; data: TripData }) {
  const t = useStrings().rules;
  const { participants, assignments, rules } = data;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const myRules = useMemo(
    () => rules.filter((r) => r.participant_id === me.id),
    [rules, me.id],
  );
  const sameGender = myRules.find((r) => r.type === "same_gender");
  const preferred = myRules.find((r) => r.type === "preferred_person");

  const unmetIds = useMemo(() => {
    const unmet = unmetRules(myRules, assignments, participants);
    return new Set(unmet.map((u) => u.rule.id));
  }, [myRules, assignments, participants]);

  const others = participants.filter((p) => p.id !== me.id);

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    setBusy(true);
    const res = await fn();
    if (!res.ok) setError(res.error ?? "");
    setBusy(false);
  }

  return (
    <section className="rules-editor">
      <h2>{t.heading}</h2>
      <p className="muted">{t.intro}</p>
      {error && <p className="banner banner--error">{error}</p>}

      {/* Same gender */}
      <div className="rule-block">
        <label className="checkline">
          <input
            type="checkbox"
            disabled={busy || !me.gender}
            checked={!!sameGender}
            onChange={(e) =>
              act(() =>
                e.target.checked
                  ? setRule(me.id, "same_gender", sameGender?.strictness ?? "preference")
                  : clearRule(me.id, "same_gender"),
              )
            }
          />
          <span>{t.sameGender}</span>
        </label>
        {!me.gender && <p className="muted">{t.sameGenderNoGender}</p>}
        {sameGender && (
          <>
            <StrictnessPicker
              value={sameGender.strictness}
              disabled={busy}
              onChange={(s) => act(() => setRule(me.id, "same_gender", s))}
            />
            {unmetIds.has(sameGender.id) && (
              <p className="banner banner--pref">{t.notMet}</p>
            )}
          </>
        )}
      </div>

      {/* Preferred person */}
      <div className="rule-block">
        <label className="field">
          <span>{t.preferredPerson}</span>
          <select
            value={preferred?.target_participant_id ?? ""}
            disabled={busy}
            onChange={(e) =>
              act(() =>
                e.target.value
                  ? setRule(
                      me.id,
                      "preferred_person",
                      preferred?.strictness ?? "preference",
                      e.target.value,
                    )
                  : clearRule(me.id, "preferred_person"),
              )
            }
          >
            <option value="">{t.preferredNone}</option>
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {preferred && (
          <>
            <StrictnessPicker
              value={preferred.strictness}
              disabled={busy}
              onChange={(s) =>
                act(() =>
                  setRule(
                    me.id,
                    "preferred_person",
                    s,
                    preferred.target_participant_id ?? undefined,
                  ),
                )
              }
            />
            {unmetIds.has(preferred.id) && (
              <p className="banner banner--pref">{t.notMet}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function StrictnessPicker({
  value,
  disabled,
  onChange,
}: {
  value: RuleStrictness;
  disabled: boolean;
  onChange: (s: RuleStrictness) => void;
}) {
  const t = useStrings().rules;
  return (
    <div className="strictness">
      <span className="muted">{t.strictness}</span>
      <label className="radio">
        <input
          type="radio"
          checked={value === "preference"}
          disabled={disabled}
          onChange={() => onChange("preference")}
        />
        <span>{t.preference}</span>
      </label>
      <label className="radio">
        <input
          type="radio"
          checked={value === "must_have"}
          disabled={disabled}
          onChange={() => onChange("must_have")}
        />
        <span>{t.mustHave}</span>
      </label>
      {value === "must_have" && <p className="muted warn">{t.mustHaveWarning}</p>}
    </div>
  );
}
