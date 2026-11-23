import { useState } from "react";
import { api, Match } from "../lib/api";
import { useApp } from "../lib/state";
import { VerdictBadge } from "./Talk";
import { DEMO_ENABLED, DEMO_NOTE, DEMO_PROFILE } from "../lib/demo";
import { ErrorBanner } from "../components/StatusStates";

const OCC = ["farmer", "student", "business", "labour", "senior", "woman", "govt", "other"];
const CATS = ["General", "BC", "MBC", "OBC", "SC", "ST", "EWS", "BPL", "Minority"];

export default function Check({ go }: { go: (t: any, id?: string) => void }) {
  const { t, lang, label, profile, updateProfile } = useApp();
  const [f, setF] = useState<Record<string, string>>({});
  const [res, setRes] = useState<{ counts: Record<string, number>; results: Match[] } | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const v = (k: string) => f[k] ?? (profile[k] as string) ?? "";
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const run = async () => {
    const data = {
      ...Object.fromEntries(["age", "gender", "occupation", "annualIncome", "state", "category", "landHectares"].map((k) => [k, v(k)])),
      landUnit: v("landUnit") || "hectare",
    };
    await updateProfile(data);
    setErr(""); setLoading(true); setRes(null);
    try {
      setRes(await api.eligibility(data, lang));
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  const mark = { pass: "✓", fail: "✗", unknown: "?" };
  const shown = res?.results.filter((r) => more || r.verdict === "ELIGIBLE" || r.verdict === "POSSIBLE_MATCH").slice(0, more ? 200 : 40) ?? [];

  return (
    <section aria-label="Check eligibility">
      <h3 id="check-heading">{t("yourDetails")}</h3>

      {DEMO_ENABLED && (
        <div className="row small">
          <button className="link" onClick={() => setF({ ...DEMO_PROFILE })}>Load sample profile (synthetic)</button>
          <span className="muted">{DEMO_NOTE}</span>
        </div>
      )}

      <fieldset aria-labelledby="check-heading" style={{ border: "none", padding: 0, margin: 0 }}>
        <div className="grid">
          <label htmlFor="chk-age">{t("age")}<input id="chk-age" type="number" value={v("age")} onChange={set("age")} min="0" max="120" /></label>
          <label htmlFor="chk-gender">{t("gender")}
            <select id="chk-gender" value={v("gender")} onChange={set("gender")}>
              <option value="" />
              <option value="male">{t("male")}</option>
              <option value="female">{t("female")}</option>
              <option value="other">{t("other")}</option>
            </select>
          </label>
          <label htmlFor="chk-occ">{t("occupation")}
            <select id="chk-occ" value={v("occupation")} onChange={set("occupation")}>
              <option value="" />
              {OCC.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label htmlFor="chk-income">{t("income")}<input id="chk-income" type="number" value={v("annualIncome")} onChange={set("annualIncome")} min="0" /></label>
          <label htmlFor="chk-state">{t("state")}<input id="chk-state" value={v("state")} onChange={set("state")} placeholder="Tamil Nadu" /></label>
          <label htmlFor="chk-cat">{t("category")}
            <select id="chk-cat" value={v("category")} onChange={set("category")}>
              <option value="" />
              {CATS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label htmlFor="chk-land">{t("land")}<input id="chk-land" type="number" step="0.01" min="0" value={v("landHectares")} onChange={set("landHectares")} /></label>
          <label htmlFor="chk-unit">Land unit
            <select id="chk-unit" value={v("landUnit") || "hectare"} onChange={set("landUnit")}>
              <option value="hectare">hectares</option>
              <option value="acre">acres</option>
            </select>
          </label>
        </div>
      </fieldset>

      <button onClick={run} disabled={loading} aria-busy={loading}>
        {loading ? "Checking…" : t("checkNow")}
      </button>

      {err && <ErrorBanner message={err} onRetry={() => setErr("")} />}

      {loading && (
        <div role="status" aria-live="polite" className="muted small" style={{ marginTop: 12 }}>
          Checking your eligibility…
        </div>
      )}

      {res && (
        <section aria-label="Eligibility results" aria-live="polite">
          <p className="muted">
            {(["ELIGIBLE", "POSSIBLE_MATCH", "NEEDS_VERIFICATION"] as const).map((k) => `${t(k)}: ${res.counts[k]}`).join(" · ")}
          </p>
          {shown.length === 0 && (
            <p className="muted small">No matching schemes found. Try adjusting your details.</p>
          )}
          {shown.map((r) => (
            <div className="card" key={r.scheme_id}>
              <div className="row">
                <b>{r.name}</b>
                <VerdictBadge v={r.verdict} />
              </div>
              <p className="muted small">
                {label("category", r.category)}{r.state ? ` · ${r.state}` : ""} · {r.criteria_met} of {r.criteria_total} checks met (not a probability of approval)
              </p>
              <ul className="criteria" aria-label={`Criteria for ${r.name}`}>
                {r.criteria.map((c, i) => (
                  <li key={i} className={c.status}>
                    <span aria-hidden="true">{mark[c.status]}</span>
                    {" "}{c.label}{c.detail ? ` — ${c.detail}` : ""}
                  </li>
                ))}
              </ul>
              {r.verdict === "POSSIBLE_MATCH" && (
                <><p className="small warn">{t("POSSIBLE_HINT")}</p><p className="small">{r.eligibility_text.join(" ")}</p></>
              )}
              {r.source_url && !r.source_official && (
                <p className="small warn">Source is not a government website. Confirm on an official source.</p>
              )}
              <div className="row small">
                {r.source_url && <a href={r.source_url} target="_blank" rel="noreferrer" aria-label={`Official source for ${r.name}`}>{t("official")} ↗</a>}
                <button className="link" onClick={() => go("apply", r.scheme_id)}>{t("apply")} →</button>
              </div>
            </div>
          ))}
          {!more && res.results.some((r) => r.verdict === "NEEDS_VERIFICATION") && (
            <button className="link" onClick={() => setMore(true)}>Show all results (including needs-review) →</button>
          )}
        </section>
      )}
    </section>
  );
}
