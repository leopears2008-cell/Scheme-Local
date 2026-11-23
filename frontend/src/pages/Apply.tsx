import { useEffect, useState } from "react";
import { api, download, FormField, Scheme, shrinkImage } from "../lib/api";
import { useApp } from "../lib/state";

const API_BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";

type Overlay = Awaited<ReturnType<typeof api.scanForm>> & { image: string };

export default function Apply({ initial, go }: { initial: string; go: (t: any, opt?: any) => void }) {
  const { t, lang, profile } = useApp();
  const [q, setQ] = useState(""); const [list, setList] = useState<Scheme[]>([]);
  const [s, setS] = useState<Scheme | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState(""); const [ref, setRef] = useState("");
  const [ov, setOv] = useState<Overlay | null>(null);

  // Phone OTP Verification states (apply only by number OTP, no guest)
  const [phoneVerified, setPhoneVerified] = useState<boolean>(() => {
    return localStorage.getItem("msg_phone_verified") === "true" || Boolean(localStorage.getItem("msg_applicant_token"));
  });
  const [mobile, setMobile] = useState<string>(() => (localStorage.getItem("msg_user_phone") || "").replace(/^\+91/, ""));
  const [otp, setOtp] = useState<string>("");
  const [otpStep, setOtpStep] = useState<1 | 2>(1);
  const [otpSending, setOtpSending] = useState<boolean>(false);
  const [otpVerifying, setOtpVerifying] = useState<boolean>(false);
  const [otpMsg, setOtpMsg] = useState<string>("");

  useEffect(() => {
    const checkAuth = () => {
      setPhoneVerified(
        localStorage.getItem("msg_phone_verified") === "true" || Boolean(localStorage.getItem("msg_applicant_token"))
      );
    };
    window.addEventListener("storage", checkAuth);
    return () => window.removeEventListener("storage", checkAuth);
  }, []);

  const sendMobileOtp = async () => {
    const cleanNum = mobile.replace(/\D/g, "");
    if (cleanNum.length !== 10) {
      setOtpMsg("Please enter a valid 10-digit mobile number");
      return;
    }
    setOtpSending(true);
    setOtpMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: `+91${cleanNum}` }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOtpStep(2);
        setOtpMsg(`OTP sent to +91 ${cleanNum}`);
      } else {
        setOtpMsg(data.detail || "Unable to send OTP. Please try again.");
      }
    } catch {
      setOtpMsg("Unable to reach verification service. Check backend connection.");
    } finally {
      setOtpSending(false);
    }
  };

  const verifyMobileOtp = async () => {
    const cleanNum = mobile.replace(/\D/g, "");
    if (otp.length !== 6) {
      setOtpMsg("Please enter the 6-digit OTP");
      return;
    }
    setOtpVerifying(true);
    setOtpMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: `+91${cleanNum}`, otp }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.phone_verified) {
        localStorage.setItem("msg_user_phone", `+91${cleanNum}`);
        localStorage.setItem("msg_phone_verified", "true");
        if (data.token) {
          localStorage.setItem("msg_applicant_token", data.token);
        }
        localStorage.removeItem("msg_guest_session"); // No guest allowed for applying
        setPhoneVerified(true);
        setOtpMsg("");
      } else {
        setOtpMsg(data.detail || "Invalid or expired OTP");
      }
    } catch {
      setOtpMsg("Verification connection error. Please try again.");
    } finally {
      setOtpVerifying(false);
    }
  };

  useEffect(() => { if (initial) api.scheme(initial, lang).then(setS).catch(() => undefined); }, [initial, lang]);
  useEffect(() => { if (!s) api.schemes({ q, lang, limit: "20" }).then((r) => setList(r.items)).catch(() => undefined); }, [q, s, lang]);
  const fields: FormField[] = s?.form_fields?.length ? s.form_fields : [
    ["fullName", "Full name"], ["dob", "Date of birth"], ["gender", "Gender"], ["aadhaarNumber", "Aadhaar"], ["phone", "Mobile"], ["address", "Address"],
    ["district", "District"], ["state", "State"], ["pincode", "Pincode"], ["annualIncome", "Annual income"]].map(([k, l]) => ({ id: k, label: l, profileKey: k, type: "text", required: false }));
  const val = (f: FormField) => vals[f.id] ?? (f.profileKey ? (profile[f.profileKey] as string) : "") ?? "";
  const byKey = () => Object.fromEntries(fields.filter((f) => f.profileKey).map((f) => [f.profileKey!, val(f)]));

  async function summary() {
    if (!phoneVerified) {
      setMsg("Mobile number OTP verification is required to generate application summary. Please verify your mobile number below.");
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
    if (!phoneVerified) {
      setMsg("Mobile number OTP verification is required to generate official application forms. Please verify your mobile number below.");
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
    if (status === "submitted" && !phoneVerified) {
      setMsg("Submission blocked: Applications can only be submitted by verified mobile phone number applicants (no guest mode).");
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

      {phoneVerified ? (
        <div className="badge ELIGIBLE" style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1rem", marginBottom: "1rem" }}>
          <span>🛡️</span>
          <span><b>Verified Applicant Identity</b> (+91 {mobile}): Mobile Number OTP Verified. Authorized to apply and submit.</span>
        </div>
      ) : (
        <div className="card warn" style={{ background: "#FFF7ED", border: "2px solid #EA580C", marginBottom: "1.25rem", padding: "1.25rem", borderRadius: "14px" }}>
          <h4 style={{ margin: "0 0 0.5rem 0", color: "#C2410C", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>📱</span> Mobile Number OTP Verification Required (No Guest Access)
          </h4>
          <p className="small" style={{ margin: "0 0 1rem 0", color: "#4B5563" }}>
            Government welfare schemes require verification of your mobile number via SMS OTP before applying. Applications cannot be submitted in guest mode.
          </p>
          {otpStep === 1 ? (
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #D1D5DB", borderRadius: "8px", overflow: "hidden", background: "#fff" }}>
                <span style={{ padding: "8px 12px", background: "#F3F4F6", fontWeight: "bold", borderRight: "1px solid #D1D5DB" }}>🇮🇳 +91</span>
                <input
                  type="tel"
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                  placeholder="98765 43210"
                  style={{ border: "none", padding: "8px 12px", outline: "none", fontSize: "1rem", width: "160px" }}
                />
              </div>
              <button
                type="button"
                onClick={sendMobileOtp}
                disabled={mobile.length !== 10 || otpSending}
                style={{ background: "#EA580C", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 18px", fontWeight: "bold", cursor: "pointer" }}
              >
                {otpSending ? "Sending OTP..." : "Send OTP"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit OTP"
                style={{ border: "1px solid #D1D5DB", borderRadius: "8px", padding: "8px 12px", fontSize: "1.1rem", letterSpacing: "3px", width: "150px" }}
              />
              <button
                type="button"
                onClick={verifyMobileOtp}
                disabled={otp.length !== 6 || otpVerifying}
                style={{ background: "#15803D", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 18px", fontWeight: "bold", cursor: "pointer" }}
              >
                {otpVerifying ? "Verifying..." : "Verify & Unlock Apply"}
              </button>
              <button
                type="button"
                onClick={() => setOtpStep(1)}
                style={{ background: "transparent", border: "none", color: "#4B5563", textDecoration: "underline", cursor: "pointer", fontSize: "0.85rem" }}
              >
                Change Number
              </button>
            </div>
          )}
          {otpMsg && <p className="small warn" style={{ marginTop: "0.5rem", marginBottom: 0, fontWeight: "bold" }}>{otpMsg}</p>}
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
