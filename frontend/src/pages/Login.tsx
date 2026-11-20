import { useState } from "react";
import { sendOtp, signInDemo, verifyOtp } from "../lib/session";
import { supabaseConfigured } from "../lib/supabase";
import { api } from "../lib/api";
import { saveGuestSession } from "../lib/guest";

const DEMO_AUTH = (import.meta.env.VITE_DEMO_AUTH as string) === "true";

/** Guest start: no OTP, no password. The email is optional and is not stored. */
function GuestStart({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true); setErr("");
    try {
      const r = await api.startGuest(email.trim() || undefined);
      saveGuestSession(r.token, r.expires_in);
      onDone();
    } catch (e) { setErr(String((e as Error).message)); }
    setBusy(false);
  };
  return (
    <section className="card">
      <h3>Continue as guest</h3>
      <p className="muted small">No code or password. Guests can browse schemes, check eligibility and chat. Guests cannot save records, upload files or use admin tools. The session lasts 2 hours and ends when you close the tab.</p>
      <label>Email (optional, not stored)<input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <button disabled={busy} onClick={start}>Continue as guest</button>
      {err && <p className="warn small" role="alert">{err}</p>}
    </section>
  );
}

export default function Login({ onDone }: { onDone: () => void }) {
  return (<>
    <LoginInner onDone={onDone} />
    <GuestStart onDone={onDone} />
  </>);
}

function LoginInner({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState("+91"); const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code">("phone"); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  if (DEMO_AUTH && supabaseConfigured) return <DemoLogin onDone={onDone} />;
  if (!supabaseConfigured) return <section className="card"><p className="warn">Login is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing).</p></section>;
  const send = async () => { setBusy(true); setErr(""); try { await sendOtp(phone.replace(/\s/g, "")); setStage("code"); } catch (e) { setErr(String((e as Error).message)); } setBusy(false); };
  const check = async () => { setBusy(true); setErr(""); try { await verifyOtp(phone.replace(/\s/g, ""), code.trim()); onDone(); } catch (e) { setErr(String((e as Error).message)); } setBusy(false); };
  return (
    <section className="card">
      <h3>Sign in with your mobile number</h3>
      <p className="muted small">We send a one-time code by SMS. Your number is used only to sign you in and to protect your applications.</p>
      {stage === "phone" ? (<>
        <label>Mobile number<input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" /></label>
        <button disabled={busy} onClick={send}>Send code</button>
      </>) : (<>
        <label>6-digit code<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></label>
        <button disabled={busy} onClick={check}>Verify and sign in</button>
        <button className="link" onClick={() => setStage("phone")}>Change number</button>
      </>)}
      {err && <p className="warn small" role="alert">{err}</p>}
    </section>
  );
}

function DemoLogin({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setErr("");
    try { await signInDemo(email, password); onDone(); } catch (e) { setErr(String((e as Error).message)); }
    setBusy(false);
  };
  return (
    <section className="card">
      <h3>Demo sign-in</h3>
      <p className="muted small">For judges: sign in with the demo account you were given. No SMS is sent.</p>
      <label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <button disabled={busy || !email || !password} onClick={go}>Sign in</button>
      {err && <p className="warn small" role="alert">{err}</p>}
    </section>
  );
}
