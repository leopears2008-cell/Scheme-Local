import { accessToken } from "./supabase";
import type { VerificationStatus } from "./contracts";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";

/** Friendly message for auth/permission failures. Never returns a silent success. */
export function authMessage(status: number): string {
  if (status === 401) return "Please sign in again to continue.";
  if (status === 403) return "Your account does not have access to this.";
  if (status === 429) return "Too many requests. Please wait a minute and try again.";
  if (status === 413) return "That file is too large. Try a smaller photo.";
  if (status >= 500) return "The service is temporarily unavailable. Please try again.";
  return "Something went wrong. Please try again.";
}

/** Authorization header only for protected calls; public calls never carry a token. */
/** Returns null when a protected call has no session: the request is then not sent at all. */
async function authHeaders(needsAuth: boolean): Promise<Record<string, string> | null> {
  if (!needsAuth) return {};
  const tok = await accessToken();
  return tok ? { Authorization: `Bearer ${tok}` } : null;
}

export function deviceId(): string {
  let id = localStorage.getItem("msg_device_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("msg_device_id", id); }
  return id;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function req<T>(path: string, init: RequestInit = {}, needsAuth = false): Promise<T> {
  const auth = await authHeaders(needsAuth);
  if (auth === null) throw new ApiError(401, "Please sign in to use this feature.");   // no request sent without a session
  let r: Response;
  try {
    r = await fetch(BASE + path, { ...init, headers: { "Content-Type": "application/json", "X-Device-Id": deviceId(), ...auth, ...(init.headers || {}) } });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  if (!r.ok) {
    let detail = "";
    try { const j = await r.json(); detail = typeof j.detail === "string" ? j.detail : ""; } catch { /* non-JSON error */ }
    throw new ApiError(r.status, detail && r.status < 500 ? detail : authMessage(r.status));
  }
  try {
    return (await r.json()) as T;
  } catch {
    throw new ApiError(r.status, "The server sent an unexpected response.");
  }
}
const post = <T,>(p: string, body: unknown, auth = false) => req<T>(p, { method: "POST", body: JSON.stringify(body) }, auth);
const authed = <T,>(p: string, init: RequestInit = {}) => req<T>(p, init, true);

export { normalizeVerification, VERIFICATION_STATES } from "./contracts";
export type { VerificationStatus } from "./contracts";

export type Verdict = "ELIGIBLE" | "POSSIBLE_MATCH" | "NEEDS_VERIFICATION" | "NOT_ELIGIBLE";
export interface Card { scheme_id: string; name: string; verdict: Verdict; why: string; evidence_quote?: string | null; benefit: string; documents: string[]; source_url: string; level?: string; state?: string; verification: string; last_verified?: string; source_official?: boolean; source_warning?: string | null }
export interface AskResponse { answer_text: string; schemes: Card[]; follow_up_question: { question: string; options: string[] } | null; confidence: number; trace_id: string; documents_checklist: { common: string[]; per_scheme: Record<string, string[]>; how_to_apply: Record<string, string> } }
export interface Scheme { source_official?: boolean; source_warning?: string | null; verification_status?: string; scheme_id: string; name: string; category: string; level: string; state: string; department?: string; benefit: string; eligibility_rules: string[]; eligibility_text?: string; documents_required: string[]; how_to_apply: string; source_url: string; verification: string; last_verified?: string; helpline?: string; has_official_form: boolean; has_form_fields: boolean; form_fields?: FormField[] }
export interface FormField { id: string; label: string; profileKey?: string; type: string; required: boolean }
export interface Criterion { key: string; label: string; status: "pass" | "fail" | "unknown"; detail: string }
export interface Match { scheme_id: string; name: string; category: string; level: string; state: string; benefit: string; source_url: string; verification: string; verdict: Verdict; score: number; criteria_met: number; criteria_total: number; criteria: Criterion[]; eligibility_text: string[]; source_official?: boolean; source_warning?: string | null }
export interface Application { id: string; scheme_id: string; scheme_name: string; status: string; reference_number?: string | null; created_at: string; updated_at: string; follow_up_date?: string | null; events: { status: string; note?: string | null; created_at: string }[] }
export interface Notice { id: number | string; kind: string; title: string; body: string; created_at: string; read: number }

export const api = {
  startGuest: (email?: string) => post<{ token: string; expires_in: number; guest: boolean; note: string }>("/api/guest/session", email ? { email } : {}),
  ask: (message: string, session_id: string, language: string) => post<AskResponse>("/api/ask", { message, session_id, language }, true),
  feedback: (trace_id: string, rating: "up" | "down") => post("/api/feedback", { trace_id, rating }, true),
  meta: () => req<{ total: number; categories: Record<string, number>; states: Record<string, number>; verification: Record<VerificationStatus, number> }>("/api/schemes/meta"),
  schemes: (p: Record<string, string>) => req<{ total: number; items: Scheme[] }>("/api/schemes?" + new URLSearchParams(p)),
  scheme: (id: string, lang: string) => req<Scheme>(`/api/schemes/${id}?lang=${lang}`),
  bookmarks: () => authed<string[]>("/api/bookmarks"),
  toggleBookmark: (id: string) => post<{ bookmarked: boolean }>(`/api/bookmarks/${id}`, {}, true),
  eligibility: (profile: Record<string, unknown>, lang: string) => post<{ counts: Record<Verdict, number>; results: Match[] }>("/api/eligibility", { profile, lang }),
  scanDoc: (image_base64: string, mime: string, consent: boolean) => post<{ doc_type: string; confidence: number; fields: Record<string, string>; quality_notes: string; aadhaar_checksum_ok?: boolean }>("/api/ocr/document", { image_base64, mime, consent }, true),
  scanForm: (image_base64: string, mime: string, consent: boolean) => post<{ language: string; fields: { label: string; labelEnglish: string; value: string; profileKey: string | null; x: number; y: number; width: number; height: number }[] }>("/api/ocr/form", { image_base64, mime, consent }, true),
  apps: () => authed<Application[]>("/api/applications"),
  createApp: (scheme_id: string, status = "draft", ref = "") => post<Application>("/api/applications", { scheme_id, status, reference_number: ref }, true),
  updateApp: (id: string, status: string, note = "", ref?: string) => authed<Application>(`/api/applications/${id}`, { method: "PATCH", body: JSON.stringify({ status, event_note: note, reference_number: ref }) }),
  deleteApp: (id: string) => authed(`/api/applications/${id}`, { method: "DELETE" }),
  notices: () => authed<Notice[]>("/api/notifications"),
  readNotices: () => post("/api/notifications/read", {}, true),
  stt: (audio_base64: string, mime: string, language: string) => post<{ text: string }>("/api/voice/stt", { audio_base64, mime, language }, true),
  tts: (text: string, language: string) => post<{ audio_base64: string; mime: string }>("/api/voice/tts", { text, language }, true),
  pdf: async (path: string, body: unknown): Promise<{ blob: Blob; ref: string | null; skipped: string | null }> => {
    const needs = path.startsWith("/api/forms/") && !path.includes("/fields");
    const auth = await authHeaders(needs);
    if (auth === null) throw new ApiError(401, "Please sign in to use this feature.");   // outside the network try
    let r: Response;
    try {
      r = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify(body) });
    } catch { throw new ApiError(0, "Cannot reach the server. Check your connection and try again."); }
    if (!r.ok) { let m = ""; try { m = (await r.json()).detail; } catch { /* ignore */ } throw new ApiError(r.status, typeof m === "string" && m && r.status < 500 ? m : authMessage(r.status)); }
    const blob = await r.blob();
    if (!blob.size) throw new ApiError(502, "The PDF was empty. Please try again.");
    return { blob, ref: r.headers.get("X-Reference"), skipped: r.headers.get("X-Skipped-Fields") };
  },
};

export function download(blob: Blob, name: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
export const fileToDataUrl = (f: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f); });

/** Shrink big phone photos before upload (keeps OCR sharp, cuts size). */
export async function shrinkImage(file: File, max = 1600): Promise<string> {
  if (!file.type.startsWith("image/")) return fileToDataUrl(file);
  const img = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}
