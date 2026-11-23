/**
 * Supabase browser client. Uses ONLY the public anon key (safe to ship); data protection comes from RLS and
 * from the backend. The service-role key must never appear in this codebase.
 */
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anon);
export const supabase = supabaseConfigured
  ? createClient(url!, anon!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  : (null as unknown as ReturnType<typeof createClient>);

import { getGuestToken } from "./guest";

/** The bearer token for backend calls: verified applicant token, Supabase sign-in, or guest token. */
export async function accessToken(): Promise<string | null> {
  const applicantToken = localStorage.getItem("msg_applicant_token");
  if (applicantToken) return applicantToken;

  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token ?? null;
    if (t) return t;
  }
  return getGuestToken();
}
