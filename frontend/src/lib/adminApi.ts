import { accessToken } from "./supabase";
const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";

async function call(path: string, init: RequestInit = {}) {
  const tok = await accessToken();
  const r = await fetch(BASE + path, { ...init, headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...(init.headers || {}) } });
  if (r.status === 401 && r.headers.get("x-reauth-required")) throw new Error("Please sign in again with a new code to make this decision.");
  if (!r.ok) { let m = r.statusText; try { m = (await r.json()).detail; } catch { /* ignore */ } throw new Error(typeof m === "string" ? m : "Request failed"); }
  return r.json();
}

export const adminApi = {
  me: () => call("/api/me"),
  list: (p: Record<string, string>) => call("/api/admin/schemes?" + new URLSearchParams(p)),
  decide: (id: string, verb: string, body: Record<string, unknown>) => call(`/api/admin/schemes/${id}/${verb}`, { method: "POST", body: JSON.stringify(body) }),
};
