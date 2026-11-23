import { useEffect, useState } from "react";
import { LANGS } from "./lib/i18n";
import { useApp } from "./lib/state";
import { api } from "./lib/api";
import Talk from "./pages/Talk"; import Find from "./pages/Find"; import Check from "./pages/Check";
import Docs from "./pages/Docs"; import Apply from "./pages/Apply"; import Track from "./pages/Track";
import Login from "./pages/Login"; import Verify from "./pages/admin/Verify";
import GuestLimit from "./pages/GuestLimit";
import SahayakHome from "./pages/SahayakHome";
import { currentSession, onAuthChange, signOut } from "./lib/session";
import { clearGuestSession, getGuestToken } from "./lib/guest";
import { supabaseConfigured } from "./lib/supabase";
import DemoBanner from "./components/DemoBanner";

const TABS = ["sahayak", "talk", "find", "check", "docs", "apply", "track"] as const;
const PROTECTED: Tab[] = ["docs", "apply", "track"];
type Tab = (typeof TABS)[number] | "login" | "admin";

export default function App() {
  const { t, lang, setLang } = useApp();
  // Open on Find: it works without sign-in, so a judge is never met by a locked screen first.
  const [tab, setTab] = useState<Tab>((location.hash.slice(1) as Tab) || "find");
  const [applyId, setApplyId] = useState<string>("");
  const [unread, setUnread] = useState(0);
  // two ways in: a real sign-in session, or a limited guest session (no account, no records, no admin)
  const [sessionSignedIn, setSignedIn] = useState(false); const [isAdmin, setIsAdmin] = useState(false);
  const [guest, setGuest] = useState<boolean>(() => getGuestToken() !== null);
  const signedIn = sessionSignedIn || guest;
  const isGuest = guest && !sessionSignedIn;
  // authReady stops the login screen flashing on refresh before the saved session has been read
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  useEffect(() => {
    if (!supabaseConfigured) return;
    currentSession().then((s) => setSignedIn(Boolean(s))).finally(() => setAuthReady(true));
    return onAuthChange(setSignedIn);
  }, []);
  // Role is read from the BACKEND (/api/me), never from the token or the UI.
  useEffect(() => {
    if (!signedIn) { setIsAdmin(false); return; }
    import("./lib/adminApi").then(({ adminApi }) => adminApi.me().then((m: any) => setIsAdmin(m.role === "admin" || m.role === "super_admin")).catch(() => setIsAdmin(false)));
  }, [signedIn]);
  const go = (x: Tab, scheme?: string) => {
    // every navigation re-reads the guest state, so a login or guest start elsewhere takes effect at once
    setGuest(getGuestToken() !== null);
    if (scheme) setApplyId(scheme); setTab(x); location.hash = x;
  };
  const endSession = () => { clearGuestSession(); setGuest(false); signOut().then(() => go("find")); };
  // notifications are a protected call: only made when a session exists (no 401 noise while signed out)
  useEffect(() => {
    if (!signedIn || isGuest) { setUnread(0); return; }   // notifications are for citizens only
    api.notices().then((n) => setUnread(n.filter((x) => !x.read).length)).catch(() => undefined);
  }, [tab, signedIn, isGuest]);
  if (tab === "sahayak") {
    return <SahayakHome onApply={() => go("apply")} onFind={() => go("find")} onCheck={() => go("check")} onSupport={() => go("talk")} onBack={() => go("find")} />;
  }

  return (
    <div className="app">
      <DemoBanner />
      <header>
        <div className="brand" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img src="/images/sahayak-logo.webp" alt="SchemeLocal emblem" style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "contain", border: "1px solid var(--line)" }} />
          <div>
            <b>SchemeLocal</b>
            <span>{t("tagline")}</span>
          </div>
        </div>
        <div className="row">
          <button
            type="button"
            className="filebtn"
            style={{ background: "#EA580C", fontWeight: "bold", fontSize: "0.8rem", padding: "5px 10px" }}
            onClick={() => go("sahayak")}
          >
            🎙️ Sahayak Portal
          </button>
          <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.script}</option>)}
          </select>
          {signedIn
            ? <button className="link" onClick={endSession}>{isGuest ? "End guest session" : "Sign out"}</button>
            : supabaseConfigured && <button className="link" onClick={() => go("login")}>Sign in</button>}
        </div>
      </header>
      <main>
        {tab === "talk" && (!authReady
          ? <p className="muted">Checking your sign-in…</p>
          : signedIn ? <Talk go={go} /> : (
            <section>
              <p className="notice">Talk needs you to sign in, so your questions stay private to your account. Find and Check work without signing in.</p>
              <button className="link" onClick={() => go("check")}>Open Check (no sign-in needed) →</button>
              <Login onDone={() => go("talk")} />
            </section>
          ))}
        {tab === "find" && <Find go={go} />}
        {tab === "check" && <Check go={go} />}
        {tab === "login" && <Login onDone={() => go("track")} />}
        {tab === "docs" && (isGuest ? <GuestLimit feature="Documents" /> : signedIn ? <Docs /> : <Login onDone={() => go("docs")} />)}
        {tab === "apply" && (isGuest ? <GuestLimit feature="Apply" /> : signedIn ? <Apply initial={applyId} go={go} /> : <Login onDone={() => go("apply")} />)}
        {tab === "track" && (isGuest ? <GuestLimit feature="Track" /> : signedIn ? <Track /> : <Login onDone={() => go("track")} />)}
        {tab === "admin" && (isAdmin ? <Verify /> : <p className="warn">Admin access only.</p>)}
      </main>
      <nav>
        {isAdmin && <button className={tab === "admin" ? "on" : ""} onClick={() => go("admin")}>Admin</button>}
        {TABS.map((x) => (
          <button key={x} className={tab === x ? "on" : ""} onClick={() => go(x)} title={PROTECTED.includes(x) && !signedIn ? "Sign in required" : PROTECTED.includes(x) && isGuest ? "Not available in guest mode" : undefined}>
            {t(x)}{x === "track" && unread > 0 && <i className="dot">{unread}</i>}
          </button>
        ))}
      </nav>
    </div>
  );
}
