import { useEffect, useRef, useState } from "react";
import { api, normalizeVerification, Scheme } from "../lib/api";
import { useApp } from "../lib/state";
import { LoadingCards, EmptyState, ErrorBanner } from "../components/StatusStates";

export function SchemeDetail({ s, go }: { s: Scheme; go: (t: any, id?: string) => void }) {
  const { t } = useApp();
  return (
    <div className="detail">
      {s.department && <p className="muted small">{s.department}</p>}
      {s.source_warning && <p className="warn small" role="alert">{s.source_warning}</p>}
      <h4>{t("eligibility")}</h4>
      <ul>{(s.eligibility_rules || []).map((r, i) => <li key={i}>{r}</li>)}</ul>
      <h4>{t("benefits")}</h4><p>{s.benefit}</p>
      <h4>{t("howToApply")}</h4><p>{s.how_to_apply}</p>
      {s.documents_required?.length > 0 && (
        <><h4>{t("docsNeeded")}</h4>
          <ul>{s.documents_required.map((d) => <li key={d}>{d}</li>)}</ul></>
      )}
      <div className="row small">
        <span className={`badge ${normalizeVerification(s.verification_status ?? s.verification)}`}>
          {t(normalizeVerification(s.verification_status ?? s.verification))}
        </span>
        {s.source_url && <a href={s.source_url} target="_blank" rel="noreferrer">{t("official")} ↗</a>}
        {s.helpline && <span>☎ {s.helpline}</span>}
      </div>
      <button onClick={() => go("apply", s.scheme_id)}>{t("apply")} →</button>
    </div>
  );
}

export default function Find({ go }: { go: (t: any, id?: string) => void }) {
  const { t, lang, label } = useApp();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [state, setState] = useState("");
  const [meta, setMeta] = useState<Awaited<ReturnType<typeof api.meta>> | null>(null);
  const [items, setItems] = useState<Scheme[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState("");
  const [marks, setMarks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLElement>(null);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => undefined);
    api.bookmarks().then(setMarks).catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    const id = setTimeout(() =>
      api.schemes({ q, category, state, lang, limit: "60" })
        .then((r) => { setItems(r.items); setTotal(r.total); setLoading(false); })
        .catch((e) => { setError(String(e)); setLoading(false); })
    , 250);
    return () => clearTimeout(id);
  }, [q, category, state, lang]);

  const toggle = async (id: string) => {
    const r = await api.toggleBookmark(id);
    setMarks((m) => (r.bookmarked ? [...m, id] : m.filter((x) => x !== id)));
  };

  return (
    <section ref={listRef} aria-label="Find government schemes">
      <label htmlFor="scheme-search" className="sr-only">Search schemes</label>
      <input
        id="scheme-search"
        className="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        autoComplete="off"
      />
      <div className="filters" role="group" aria-label="Filter schemes">
        <label htmlFor="cat-filter" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>Category</label>
        <select id="cat-filter" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">{t("allCategories")}</option>
          {meta && Object.entries(meta.categories).map(([k, n]) => (
            <option key={k} value={k}>{label("category", k)} ({n})</option>
          ))}
        </select>
        <label htmlFor="state-filter" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>State</label>
        <select id="state-filter" value={state} onChange={(e) => setState(e.target.value)} aria-label="State">
          <option value="">{t("allStates")}</option>
          {meta && Object.keys(meta.states).filter((s) => s !== "central").map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <p className="muted small" aria-live="polite">
        {!loading && `${total} ${t("results")}${meta ? ` · ${meta.verification?.verified ?? 0} ✓ verified` : ""}`}
      </p>

      {loading && <LoadingCards count={4} />}
      {error && <ErrorBanner message={`Failed to load schemes: ${error}`} onRetry={() => setError("")} />}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon="🔍"
          title="No schemes found"
          body={q ? `No results for "${q}". Try a different word or remove filters.` : "No schemes match the current filters."}
          action={<button className="link" onClick={() => { setQ(""); setCategory(""); setState(""); }}>Clear filters</button>}
        />
      )}

      {!loading && items.map((s) => (
        <div className="card" key={s.scheme_id}>
          <div className="row">
            <b
              onClick={() => setOpen(open === s.scheme_id ? "" : s.scheme_id)}
              className="pointer"
              role="button"
              tabIndex={0}
              aria-expanded={open === s.scheme_id}
              onKeyDown={(e) => e.key === "Enter" && setOpen(open === s.scheme_id ? "" : s.scheme_id)}
            >
              {s.name}
            </b>
            <button
              className="link"
              onClick={() => toggle(s.scheme_id)}
              aria-label={marks.includes(s.scheme_id) ? `Remove bookmark for ${s.name}` : `Bookmark ${s.name}`}
            >
              {marks.includes(s.scheme_id) ? `★ ${t("saved")}` : `☆ ${t("bookmark")}`}
            </button>
          </div>
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
