import { useEffect, useState } from "react";
import { api, normalizeVerification, Scheme } from "../lib/api";
import { useApp } from "../lib/state";

export function SchemeDetail({ s, go }: { s: Scheme; go: (t: any, id?: string) => void }) {
  const { t } = useApp();
  return (
    <div className="detail">
      {s.department && <p className="muted">{s.department}</p>}
      {s.source_warning && <p className="warn small">{s.source_warning}</p>}
      <h4>{t("eligibility")}</h4><ul>{(s.eligibility_rules || []).map((r, i) => <li key={i}>{r}</li>)}</ul>
      <h4>{t("benefits")}</h4><p>{s.benefit}</p>
      <h4>{t("howToApply")}</h4><p>{s.how_to_apply}</p>
      {s.documents_required?.length > 0 && <><h4>{t("docsNeeded")}</h4><ul>{s.documents_required.map((d) => <li key={d}>{d}</li>)}</ul></>}
      <div className="row small">
        <span className={`badge ${normalizeVerification(s.verification_status ?? s.verification)}`}>{t(normalizeVerification(s.verification_status ?? s.verification))}</span>
        {s.source_url && <a href={s.source_url} target="_blank" rel="noreferrer">{t("official")} ↗</a>}
        {s.helpline && <span>☎ {s.helpline}</span>}
      </div>
      <button onClick={() => go("apply", s.scheme_id)}>{t("apply")} →</button>
    </div>
  );
}

export default function Find({ go }: { go: (t: any, id?: string) => void }) {
  const { t, lang, label } = useApp();
  const [q, setQ] = useState(""); const [category, setCategory] = useState(""); const [state, setState] = useState("");
  const [meta, setMeta] = useState<Awaited<ReturnType<typeof api.meta>> | null>(null);
  const [items, setItems] = useState<Scheme[]>([]); const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(""); const [marks, setMarks] = useState<string[]>([]);
  useEffect(() => { api.meta().then(setMeta).catch(() => undefined); api.bookmarks().then(setMarks).catch(() => undefined); }, []);
  useEffect(() => {
    const id = setTimeout(() => api.schemes({ q, category, state, lang, limit: "60" }).then((r) => { setItems(r.items); setTotal(r.total); }).catch(() => undefined), 250);
    return () => clearTimeout(id);
  }, [q, category, state, lang]);
  const toggle = async (id: string) => { const r = await api.toggleBookmark(id); setMarks((m) => (r.bookmarked ? [...m, id] : m.filter((x) => x !== id))); };
  return (
    <section>
      <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} />
      <div className="filters">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t("allCategories")}</option>
          {meta && Object.entries(meta.categories).map(([k, n]) => <option key={k} value={k}>{label("category", k)} ({n})</option>)}
        </select>
        <select value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">{t("allStates")}</option>
          {meta && Object.keys(meta.states).filter((s) => s !== "central").map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <p className="muted small">{total} {t("results")}{meta ? ` · ${meta.verification?.verified ?? 0} ✓` : ""}</p>
      {items.map((s) => (
        <div className="card" key={s.scheme_id}>
          <div className="row"><b onClick={() => setOpen(open === s.scheme_id ? "" : s.scheme_id)} className="pointer">{s.name}</b>
            <button className="link" onClick={() => toggle(s.scheme_id)}>{marks.includes(s.scheme_id) ? `★ ${t("saved")}` : `☆ ${t("bookmark")}`}</button></div>
          <p className="muted small">{label("category", s.category)}{s.state ? ` · ${s.state}` : " · India"}</p>
          {s.benefit
            ? <p>{s.benefit.slice(0, 160)}{s.benefit.length > 160 ? "…" : ""}</p>
            : <p className="warn small">Details pending official verification. Check the official source before applying.</p>}
          {open === s.scheme_id && <SchemeDetail s={s} go={go} />}
        </div>
      ))}
    </section>
  );
}
