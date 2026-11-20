import { useState } from "react";
import { api, Match } from "../lib/api";
import { useApp } from "../lib/state";
import { VerdictBadge } from "./Talk";
import { DEMO_ENABLED, DEMO_NOTE, DEMO_PROFILE } from "../lib/demo";

const OCC = ["farmer", "student", "business", "labour", "senior", "woman", "govt", "other"];
// caste/community categories and economic categories are kept separate on purpose
const CATS = ["General", "BC", "MBC", "OBC", "SC", "ST", "EWS", "BPL", "Minority"];

export default function Check({ go }: { go: (t: any, id?: string) => void }) {
  const { t, lang, label, profile, updateProfile } = useApp();
  const [f, setF] = useState<Record<string, string>>({});
  const [res, setRes] = useState<{ counts: Record<string, number>; results: Match[] } | null>(null);
  const [err, setErr] = useState(""); const [more, setMore] = useState(false);
  const v = (k: string) => f[k] ?? (profile[k] as string) ?? "";
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const run = async () => {
    // the unit travels with the number so acres are never read as hectares
    const data = {
      ...Object.fromEntries(["age", "gender", "occupation", "annualIncome", "state", "category", "landHectares"].map((k) => [k, v(k)])),
      landUnit: v("landUnit") || "hectare",   // send the unit the dropdown is showing
    };
    await updateProfile(data); setErr("");
    try { setRes(await api.eligibility(data, lang)); } catch (e) { setErr(String(e)); }
  };
  const mark = { pass: "✓", fail: "✗", unknown: "?" };
  const shown = res?.results.filter((r) => more || r.verdict === "ELIGIBLE" || r.verdict === "POSSIBLE_MATCH").slice(0, more ? 200 : 40) ?? [];
  return (
    <section>
      <h3>{t("yourDetails")}</h3>
      {DEMO_ENABLED && (
        <div className="row small">
          <button className="link" onClick={() => setF({ ...DEMO_PROFILE })}>Load sample profile (synthetic)</button>
          <span className="muted">{DEMO_NOTE}</span>
        </div>
      )}
      <div className="grid">
        <label>{t("age")}<input type="number" value={v("age")} onChange={set("age")} /></label>
        <label>{t("gender")}<select value={v("gender")} onChange={set("gender")}><option value="" /><option value="male">{t("male")}</option><option value="female">{t("female")}</option><option value="other">{t("other")}</option></select></label>
        <label>{t("occupation")}<select value={v("occupation")} onChange={set("occupation")}><option value="" />{OCC.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
        <label>{t("income")}<input type="number" value={v("annualIncome")} onChange={set("annualIncome")} /></label>
        <label>{t("state")}<input value={v("state")} onChange={set("state")} placeholder="Tamil Nadu" /></label>
        <label>{t("category")}<select value={v("category")} onChange={set("category")}><option value="" />{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>{t("land")}<input type="number" step="0.01" min="0" value={v("landHectares")} onChange={set("landHectares")} /></label>
        <label>Land unit<select value={v("landUnit") || "hectare"} onChange={set("landUnit")}>
          <option value="hectare">hectares</option><option value="acre">acres</option>
        </select></label>
      </div>
      <button onClick={run}>{t("checkNow")}</button>
      {err && <p className="warn">{err}</p>}
      {res && <>
        <p className="muted">{(["ELIGIBLE", "POSSIBLE_MATCH", "NEEDS_VERIFICATION"] as const).map((k) => `${t(k)}: ${res.counts[k]}`).join(" · ")}</p>
        {shown.map((r) => (
          <div className="card" key={r.scheme_id}>
            <div className="row"><b>{r.name}</b><VerdictBadge v={r.verdict} /></div>
            <p className="muted small">{label("category", r.category)}{r.state ? ` · ${r.state}` : ""} · {r.criteria_met} of {r.criteria_total} checks met (not a probability of approval)</p>
            <ul className="criteria">{r.criteria.map((c, i) => <li key={i} className={c.status}>{mark[c.status]} {c.label}{c.detail ? ` — ${c.detail}` : ""}</li>)}</ul>
            {r.verdict === "POSSIBLE_MATCH" && <><p className="small warn">{t("POSSIBLE_HINT")}</p><p className="small">{r.eligibility_text.join(" ")}</p></>}
            {r.source_url && !r.source_official && <p className="small warn">Source is not a government website. Confirm on an official source.</p>}
            <div className="row small">{r.source_url && <a href={r.source_url} target="_blank" rel="noreferrer">{t("official")} ↗</a>}<button className="link" onClick={() => go("apply", r.scheme_id)}>{t("apply")} →</button></div>
          </div>
        ))}
        {!more && <button className="link" onClick={() => setMore(true)}>{t("NEEDS_VERIFICATION")} →</button>}
      </>}
    </section>
  );
}
