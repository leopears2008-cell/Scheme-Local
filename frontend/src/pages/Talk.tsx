import { useEffect, useRef, useState } from "react";
import { api, AskResponse, Card, normalizeVerification } from "../lib/api";
import { useApp } from "../lib/state";
import { listen, speak, stopSpeaking } from "../lib/voice";

interface Msg { role: "user" | "bot"; text: string; res?: AskResponse }

export function VerdictBadge({ v }: { v: string }) {
  const { t } = useApp();
  return <span className={`badge ${v}`}>{t(v)}</span>;
}

function SchemeCard({ c, go }: { c: Card; go: (t: any, id?: string) => void }) {
  const { t } = useApp();
  return (
    <div className="card">
      <div className="row"><b>{c.name}</b><VerdictBadge v={c.verdict} /></div>
      {c.why && <p>{c.why}</p>}
      {c.evidence_quote && <blockquote>“{c.evidence_quote}”</blockquote>}
      {c.benefit && <p className="muted">{c.benefit}</p>}
      {c.source_warning && <p className="small warn">{c.source_warning}</p>}
      <div className="row small">
        <span className={`badge ${normalizeVerification(c.verification)}`}>
          {t(normalizeVerification(c.verification))}{normalizeVerification(c.verification) === "verified" && c.last_verified ? ` (${c.last_verified})` : ""}
        </span>
        {c.source_url && <a href={c.source_url} target="_blank" rel="noreferrer">{t("official")} ↗</a>}
      </div>
      <button className="link" onClick={() => go("apply", c.scheme_id)}>{t("apply")} →</button>
    </div>
  );
}

export default function Talk({ go }: { go: (t: any, id?: string) => void }) {
  const { t, lang, sessionId } = useApp();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<null | (() => void)>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  async function send(message: string) {
    if (!message.trim() || busy) return;
    setMsgs((m) => [...m, { role: "user", text: message }]); setText(""); setBusy(true);
    try {
      const res = await api.ask(message, sessionId, lang);
      setMsgs((m) => [...m, { role: "bot", text: res.answer_text, res }]);
    } catch (e) { setMsgs((m) => [...m, { role: "bot", text: `${t("errBusy")} (${String(e)})` }]); }
    setBusy(false);
  }
  const mic = () => {
    if (rec) { rec(); setRec(null); return; }
    setRec(() => listen(lang, (x) => { setText(x); send(x); }, () => setRec(null), (e) => setMsgs((m) => [...m, { role: "bot", text: e }])));
  };

  return (
    <section className="chat">
      {msgs.length === 0 && <p className="welcome">{t("welcome")}</p>}
      {msgs.map((m, i) => (
        <div key={i} className={`msg ${m.role}`}>
          <p>{m.text}</p>
          {m.role === "bot" && m.text && <button className="link" onClick={() => speak(m.text, lang).catch(() => undefined)} onDoubleClick={stopSpeaking}>🔊 {t("readAloud")}</button>}
          {m.res?.schemes.map((c) => <SchemeCard key={c.scheme_id} c={c} go={go} />)}
          {m.res && m.res.documents_checklist && (m.res.documents_checklist.common.length > 0 || Object.keys(m.res.documents_checklist.per_scheme).length > 0) && (
            <div className="card">
              <b>{t("checklist")}</b>
              {m.res.documents_checklist.common.length > 0 && <><p className="muted">{t("common")}</p><ul>{m.res.documents_checklist.common.map((d) => <li key={d}>{d}</li>)}</ul></>}
              {Object.entries(m.res.documents_checklist.per_scheme).map(([n, ds]) => ds.length > 0 && <div key={n}><p className="muted">{n}</p><ul>{ds.map((d) => <li key={d}>{d}</li>)}</ul></div>)}
            </div>
          )}
          {m.res?.follow_up_question && (
            <div className="chips">
              <p><b>{m.res.follow_up_question.question}</b></p>
              {(Array.isArray(m.res.follow_up_question.options) ? m.res.follow_up_question.options : []).map((o) => <button key={o} onClick={() => send(o)}>{o}</button>)}
            </div>
          )}
          {m.res && <div className="row small muted">{t("confidence")}: {Math.round(m.res.confidence * 100)}% · {t("followUp")}
            <button className="link" onClick={() => api.feedback(m.res!.trace_id, "up")}>👍</button>
            <button className="link" onClick={() => api.feedback(m.res!.trace_id, "down")}>👎</button></div>}
        </div>
      ))}
      {busy && <div className="msg bot"><p>…</p></div>}
      <div ref={end} />
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <button type="button" className={rec ? "rec" : ""} onClick={mic} aria-label={t("mic")}>{rec ? "■" : "🎤"}</button>
        <input value={rec ? t("listening") : text} onChange={(e) => setText(e.target.value)} placeholder={t("askPlaceholder")} />
        <button type="submit" disabled={busy}>{t("send")}</button>
      </form>
    </section>
  );
}
