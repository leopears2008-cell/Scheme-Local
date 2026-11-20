/**
 * Guest session on this device/tab. Held in sessionStorage, so it ends when the tab closes.
 * The server decides what a guest may do; this file only remembers the token and when it expires.
 */
import { isGuestTokenValid } from "./contracts";

const KEY = "msg_guest_session";

type Stored = { token: string; expiresAt: number };

export function saveGuestSession(token: string, expiresInSeconds: number): void {
  const s: Stored = { token, expiresAt: Date.now() + expiresInSeconds * 1000 };
  try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked: guest mode simply won't persist */ }
}

export function getGuestToken(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (!isGuestTokenValid(s.expiresAt)) { clearGuestSession(); return null; }
    return s.token;
  } catch {
    return null;
  }
}

export function clearGuestSession(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
