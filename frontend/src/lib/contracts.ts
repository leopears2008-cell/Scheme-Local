/**
 * Pure helpers that define the API contract on the frontend. No React, no browser APIs, so they can be
 * unit-tested directly (see frontend/tests/contracts.test.mjs).
 */

/** Canonical verification states, shared with the backend (schemes_store.CANONICAL_STATUSES). */
export type VerificationStatus = "verified" | "needs_review" | "unverified" | "expired";
export const VERIFICATION_STATES: VerificationStatus[] = ["verified", "needs_review", "unverified", "expired"];

/** Anything not in the canonical list is treated as unverified, never as verified. */
export function normalizeVerification(v: unknown): VerificationStatus {
  return (VERIFICATION_STATES as string[]).includes(String(v)) ? (v as VerificationStatus) : "unverified";
}

/** Invalid or missing timestamps show a dash instead of "Invalid Date". */
export function formatDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

/** Client-side check only; the backend enforces the same rule and remains the authority. */
export function isGovHttps(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    return u.protocol === "https:" && (h.endsWith(".gov.in") || h.endsWith(".nic.in") || h.endsWith(".gov") || h.endsWith(".nic"));
  } catch {
    return false;
  }
}

/** A guest token is used only while its (server-given) expiry is still in the future. Default margin: 30 s. */
export function isGuestTokenValid(expiresAtMs: number | null | undefined, now: number = Date.now(), marginMs = 30_000): boolean {
  return typeof expiresAtMs === "number" && Number.isFinite(expiresAtMs) && expiresAtMs - marginMs > now;
}
