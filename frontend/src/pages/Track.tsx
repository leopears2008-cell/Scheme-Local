import { useEffect, useState } from "react";
import { api, Application, Notice } from "../lib/api";
import { useApp } from "../lib/state";
import { formatDate } from "../lib/contracts";

const STEPS = ["draft", "submitted", "under_review", "need_documents", "approved", "rejected"];

export default function Track() {
  const { t } = useApp();
  const [apps, setApps] = useState<Application[]>([]); const [notes, setNotes] = useState<Notice[]>([]);
  const load = () => { api.apps().then(setApps).catch(() => undefined); api.notices().then(setNotes).catch(() => undefined); };
  useEffect(load, []);
  const [msg, setMsg] = useState("");
  const fail = (e: unknown) => setMsg(String((e as Error).message || "Something went wrong. Please try again."));
  const change = (a: Application, s: string) => api.updateApp(a.id, s).then(load).catch(fail);
  return (
    <section>
      {msg && <p className="warn small" role="alert">{msg}</p>}
      {apps.length === 0 && <p className="muted">{t("noApps")}</p>}
      {apps.map((a) => (
        <div className="card" key={a.id}>
          <div className="row"><b>{a.scheme_name}</b><button className="link" onClick={() => api.deleteApp(a.id).then(load).catch(fail)}>🗑</button></div>
          {a.reference_number && <p className="muted small">{t("refNo")}: {a.reference_number}</p>}
          <select value={a.status} onChange={(e) => change(a, e.target.value)}>{STEPS.map((s) => <option key={s} value={s}>{t(s)}</option>)}</select>
          <ol className="timeline">{a.events.map((e, i) => <li key={i}><b>{t(e.status)}</b> <span className="muted small">{formatDate(e.created_at)}</span>{e.note && e.note !== "Created" && <span> — {e.note}</span>}</li>)}</ol>
        </div>
      ))}
      <div className="row"><h4>{t("notifications")}</h4><button className="link" onClick={() => api.readNotices().then(load).catch(fail)}>{t("markRead")}</button></div>
      {notes.map((n) => <div className={`card ${n.read ? "" : "unread"}`} key={n.id}><b>{n.title}</b><p>{n.body}</p><p className="muted small">{formatDate(n.created_at)}</p></div>)}
    </section>
  );
}
