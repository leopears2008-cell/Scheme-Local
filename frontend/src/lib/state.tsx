import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { makeT, shared_ } from "./i18n";
import { getProfile, saveProfile, ProfileData } from "./profile-vault";

interface Ctx {
  lang: string; setLang: (l: string) => void; t: (k: string) => string; label: (ns: string, k: string) => string;
  profile: ProfileData; updateProfile: (p: ProfileData) => Promise<void>;
  sessionId: string;
}
const C = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(C);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState(localStorage.getItem("msg_lang") || "en");
  const [profile, setProfile] = useState<ProfileData>({});
  const sessionId = useMemo(() => crypto.randomUUID(), []);
  useEffect(() => { getProfile().then(setProfile).catch(() => undefined); }, []);
  const setLang = (l: string) => { localStorage.setItem("msg_lang", l); setLangState(l); document.documentElement.lang = l; document.documentElement.dir = l === "ur" ? "rtl" : "ltr"; };
  const updateProfile = useCallback(async (p: ProfileData) => {
    const merged = { ...profile, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== "")) };
    setProfile(merged); await saveProfile(merged);
  }, [profile]);
  const t = useMemo(() => makeT(lang), [lang]);
  const label = useCallback((ns: string, k: string) => shared_(lang, ns, k), [lang]);
  return <C.Provider value={{ lang, setLang, t, label, profile, updateProfile, sessionId }}>{children}</C.Provider>;
}
