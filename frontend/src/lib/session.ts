import { clearGuestSession } from "./guest";
import { supabase, supabaseConfigured } from "./supabase";

/** Phone-OTP sign-in. Phone must be E.164 (+91...). Supabase sends the SMS through its configured provider. */
export async function sendOtp(phone: string) {
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error("Enter your mobile number with country code, e.g. +91 98765 43210");
  const { error } = await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: true } });
  if (error) throw error;
}
export async function verifyOtp(phone: string, token: string) {
  if (!/^\d{4,8}$/.test(token)) throw new Error("Enter the code from the SMS");
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) throw error;
  return data.session;
}
export async function signOut() {
  clearGuestSession();
  if (supabaseConfigured) await supabase.auth.signOut();
}
export async function currentSession() {
  if (!supabaseConfigured) return null;
  return (await supabase.auth.getSession()).data.session;
}
export function onAuthChange(cb: (signedIn: boolean) => void) {
  if (!supabaseConfigured) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_e, s) => cb(Boolean(s)));
  return () => data.subscription.unsubscribe();
}

/**
 * Demo sign-in for named judge accounts (email + password, no SMS). The backend accepts these only when
 * DEMO_AUTH_ENABLED=true and the email is on DEMO_AUTH_EMAILS. Shown only when VITE_DEMO_AUTH=true.
 */
export async function signInDemo(email: string, password: string) {
  if (!supabaseConfigured) throw new Error("Sign-in is not configured on this site.");
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data.session;
}
