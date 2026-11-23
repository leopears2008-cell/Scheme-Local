import { useEffect, useState } from "react";
import { api, download, FormField, Scheme, shrinkImage } from "../lib/api";
import { useApp } from "../lib/state";

type Overlay = Awaited<ReturnType<typeof api.scanForm>> & { image: string };

export default function Apply({ initial, go }: { initial: string; go: (t: any) => void }) {
  const { t, lang, profile } = useApp();
  const [q, setQ] = useState(""); const [list, setList] = useState<Scheme[]>([]);
  const [s, setS] = useState<Scheme | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState(""); const [ref, setRef] = useState("");
  const [ov, setOv] = useState<Overlay | null>(null);
  const [isDualVerified, setIsDualVerified] = useState<boolean>(() => {
    return Boolean(
      localStorage.getItem("msg_applicant_token") ||
      (localStorage.getItem("msg_phone_verified") === "true" && localStorage.getItem("msg_email_verified") === "true")
    );
  });

  useEffect(() => {
    const checkAuth = () => {
      setIsDualVerified(
        Boolean(
          localStorage.getItem("msg_applicant_token") ||
          (localStorage.getItem("msg_phone_verified") === "true" && localStorage.getItem("msg_email_verified") === "true")
        )
      );
    };
    window.addEventListener("storage", checkAuth);
    return () => window.removeEventListener("storage", checkAuth);
  }, []);

  useEffect(() => { if (initial) api.scheme(initial, lang).then(setS).catch(() => undefined); }, [initial, lang]);
  useEffect(() => { if (!s) api.schemes({ q, lang, limit: "20" }).then((r) => setList(r.items)).catch(() => undefined); }, [q, s, lang]);
  const fields: FormField[] = s?.form_fields?.length ? s.form_fields : [
    ["fullName", "Full name"], ["dob", "Date of birth"], ["gender", "Gender"], ["aadhaarNumber", "Aadhaar"], ["phone", "Mobile"], ["address", "Address"],
    ["district", "District"], ["state", "State"], ["pincode", "Pincode"], ["annualIncome", "Annual income"]].map(([k, l]) => ({ id: k, label: l, profileKey: k, type: "text", required: false }));
  const val = (f: FormField) => vals[f.id] ?? (f.profileKey ? (profile[f.profileKey] as string) : "") ?? "";
  const byKey = () => Object.fromEntries(fields.filter((f) => f.profileKey).map((f) => [f.profileKey!, val(f)]));

  async function summary() {
    if (!isDualVerified) {
      setMsg("Identity verification required: Please complete both Mobile and Email OTP verification before generating application summary.");
      return;
    }
    try {
      const r = await api.pdf("/api/forms/summary", { scheme_id: s!.scheme_id, fields: fields.map((f) => ({ label: f.label, value: val(f) })) });
      setRef(r.ref || ""); download(r.blob, `${s!.scheme_id}-summary.pdf`);
    } catch (e) {
      setMsg(String((e as Error).message || e));
    }
  }
  async function official() {
    if (!isDualVerified) {
      setMsg("Identity verification required: Please complete both Mobile and Email OTP verification before generating official forms.");
      return;
    }
    try {
      const r = await api.pdf("/api/forms/official", { scheme_id: s!.scheme_id, values: { ...profile, ...byKey() } });
      download(r.blob, `${s!.scheme_id}-form.pdf`);
      setMsg(r.skipped ? t("nonLatinNote") : "");
    } catch (e) {
      setMsg(String((e as Error).message || e));
    }
  }
  async function track(status: string) {
    if (status === "submitted" && !isDualVerified) {
      setMsg("Submission blocked: Applications can only be submitted by verified applicants with dual mobile & email OTP.");
      return;
    }
    try {
      await api.createApp(s!.scheme_id, status, ref);
      go("track");
    } catch (e) {
      setMsg(String((e as Error).message || e));
    }
  }
  async function onScan(file?: File) {
    if (!file) return;
    if (!window.confirm("This form photo will be sent to Google Gemini (an AI service) to read its fields. Continue?")) return;
    setMsg("…");
    try { const image = await shrinkImage(file); setOv({ ...(await api.scanForm(image, "image/jpeg", true)), image }); setMsg(""); } catch (e) { setMsg(String((e as Error).message)); }
  }
  async function overlay() {
    if (!ov) return;
    const fs = ov.fields.map((f) => ({ value: f.value || (f.profileKey ? (vals[f.profileKey] ?? (profile[f.profileKey] as string)) : "") || "", x: f.x, y: f.y, width: f.width, height: f.height }));
    try {
      const r = await api.pdf("/api/forms/overlay", { image_base64: ov.image, fields: fs });
      download(r.blob, "filled-form.pdf");
    } catch (e) {
      setMsg(String((e as Error).message || e));
    }
  }

  if (!s) return (
    <section>
      <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} />
      {msg && <p className="warn small" role="alert">{msg}</p>}
      {list.map((x) => <div className="card pointer" key={x.scheme_id} onClick={() => api.scheme(x.scheme_id, lang).then(setS).catch((e) => setMsg(String((e as Error).message)))}><b>{x.name}</b>{x.has_official_form && <span className="badge ELIGIBLE">PDF</span>}</div>)}
    </section>
  );
  return (
    <section>
      <button className="link" onClick={() => { setS(null); setOv(null); }}>← {t("apply")}</button>
      <h3>{s.name}</h3>

      {isDualVerified ? (
        <div className="badge ELIGIBLE" style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", marginBottom: "1rem" }}>
          <span>🛡️</span>
          <span><b>Verified Applicant Identity</b>: Mobile OTP & Email OTP verified. Server-authorized to apply.</span>
        </div>
      ) : (
        <div className="card warn" style={{ background: "#FFF7ED", border: "1px solid #EA580C", marginBottom: "1rem" }}>
          <p className="warn small" style={{ margin: 0 }}>
            <b>⚠️ Real Identity Verification Required</b>: To prevent fraudulent applications, government submission requires dual Mobile OTP and Email OTP verification. Unverified/guest applications are blocked server-side.
          </p>
          <div style={{ marginTop: "0.5rem" }}>
            <button
              type="button"
              onClick={() => go("login")}
              style={{ background: "#EA580C", color: "#fff", border: "none", borderRadius: "8px", padding: "6px 14px", fontWeight: "bold", cursor: "pointer" }}
            >
              Verify Mobile & Email Now →
            </button>
          </div>
        </div>
      )}

      <div className="grid">{fields.map((f) => <label key={f.id}>{f.label}{f.required ? " *" : ""}<input value={val(f)} onChange={(e) => setVals({ ...vals, [f.id]: e.target.value })} /></label>)}</div>
      <div className="actions">
        {s.has_official_form ? <button onClick={official}>{t("officialForm")}</button> : <p className="muted small">{t("noFormFor")}</p>}
        <button onClick={summary}>{t("summaryPdf")}</button>
        <label className="filebtn">{t("scanOwn")}<input type="file" accept="image/*" hidden onChange={(e) => onScan(e.target.files?.[0])} /></label>
      </div>
      {ov && <div className="card"><p className="muted small">{ov.fields.length} fields · {ov.language}</p><button onClick={overlay}>{t("overlayPdf")}</button></div>}
      {msg && <p className="warn small">{msg}</p>}
      {s.documents_required?.length > 0 && <><h4>{t("docsNeeded")}</h4><ul>{s.documents_required.map((d) => <li key={d}>{d}</li>)}</ul></>}
      <div className="card">
        <label>{t("refNo")}<input value={ref} onChange={(e) => setRef(e.target.value)} /></label>
        <div className="actions"><button onClick={() => track("draft")}>{t("trackIt")}</button><button onClick={() => track("submitted")}>{t("submitted")} ✓</button>
          {s.source_url && <a href={s.source_url} target="_blank" rel="noreferrer">{t("official")} ↗</a>}</div>
      </div>
    </section>
  );
}
