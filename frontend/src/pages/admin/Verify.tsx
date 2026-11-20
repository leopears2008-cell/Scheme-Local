import { useEffect, useState } from "react";
import { adminApi } from "../../lib/adminApi";
import { isGovHttps } from "../../lib/contracts";

type Row = any;
const STATUS = ["", "verified", "needs_review", "unverified", "expired"];

export default function Verify() {
  const [q, setQ] = useState(""); const [status, setStatus] = useState("");
  const [data, setData] = useState<{ counts: Record<string, number>; items: Row[] } | null>(null);
  const [sel, setSel] = useState<Row | null>(null); const [note, setNote] = useState(""); const [src, setSrc] = useState(""); const [msg, setMsg] = useState("");
  const load = () => adminApi.list({ q, status }).then(setData).catch((e) => setMsg(String(e.message)));
  useEffect(() => { load(); }, [q, status]);
  const srcOk = isGovHttps(src);
  const act = async (verb: "verify" | "reject" | "expire" | "request-review") => {
    if (!sel) return;
    try {
      const url = (src || sel.official_source_url || "").trim();
      if (verb === "verify" && !isGovHttps(url)) { setMsg("Verification needs an official https source on a government domain."); return; }
      await adminApi.decide(sel.scheme_id, verb, { note, source_url: url || undefined, source_type: sel.source_type || "central_portal" });
      setMsg(`${verb}: done`); setNote(""); setSrc(""); setSel(null); load();
    } catch (e: any) { setMsg(e.message); }
  };
  return (
    <section>
      <div className="row small">
        {data && Object.entries(data.counts).map(([k, n]) => <span key={k} className={`badge ${k}`}>{k}: {n}</span>)}
      </div>
      <input className="search" placeholder="Search name, id or department" value={q} onChange={(e) => setQ(e.target.value)} />
      <select value={status} onChange={(e) => setStatus(e.target.value)}>{STATUS.map((s) => <option key={s} value={s}>{s || "all statuses"}</option>)}</select>
      {msg && <p className="small warn" role="status">{msg}</p>}
      {data?.items.map((r) => (
        <div key={r.scheme_id} className="card pointer" onClick={() => setSel(r)}>
          <div className="row"><b>{r.official_name}</b><span className={`badge ${r.verification_status}`}>{r.verification_status}</span></div>
          <p className="muted small">{r.scheme_id} · {r.government_level}{r.state ? ` · ${r.state}` : ""} · v{r.version}</p>
        </div>
      ))}
      {sel && (
        <div className="card">
          <h4>{sel.official_name}</h4>
          <p className="small muted">{sel.scheme_id} · {sel.government_level}{sel.state ? ` · ${sel.state}` : ""} · status: <b>{sel.verification_status}</b> · version {sel.version}</p>
          <h5>Eligibility (as recorded)</h5>
          {(sel.official_eligibility || []).length ? <ul>{sel.official_eligibility.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul> : <p className="warn small">Not recorded. Do not verify until eligibility is entered from the official source.</p>}
          <h5>Benefits</h5>
          <p className="small">{sel.official_benefits || <span className="warn">Not recorded.</span>}</p>
          <h5>Required documents</h5>
          {(sel.documents || []).length ? <ul>{sel.documents.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul> : <p className="warn small">Not recorded.</p>}
          <p className="small">Official source: {sel.official_source_url ? <a href={sel.official_source_url} target="_blank" rel="noreferrer">{sel.official_source_url}</a> : <span className="warn">none recorded</span>}</p>
          <label>Review note (what you checked)<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} /></label>
          <label>Official source URL (https, government domain)<input value={src} onChange={(e) => setSrc(e.target.value)} placeholder={sel.official_source_url || "https://..."} aria-invalid={src !== "" && !srcOk} /></label>
          {src && !srcOk && <p className="warn small">Enter a full https address on a government domain (for example https://pmkisan.gov.in/).</p>}
          <div className="actions">
            <button onClick={() => act("verify")} disabled={!isGovHttps((src || sel.official_source_url || "").trim())}>Verify</button>
            <button onClick={() => act("reject")}>Reject verification</button>
            <button onClick={() => act("expire")}>Mark expired</button>
            <button onClick={() => act("request-review")}>Needs review</button>
          </div>
          <p className="muted small">Verify needs a fresh OTP login (you may be asked to sign in again). Every decision is recorded with your masked phone.</p>
        </div>
      )}
    </section>
  );
}
