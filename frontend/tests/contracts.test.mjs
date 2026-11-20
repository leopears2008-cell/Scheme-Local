// Frontend tests for the API contract helpers (status, dates, official-source check). Node built-in runner.
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const out = join(mkdtempSync(join(tmpdir(), "contracts-")), "contracts.mjs");
await build({ entryPoints: ["src/lib/contracts.ts"], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "silent" });
const { normalizeVerification, formatDate, isGovHttps, isGuestTokenValid } = await import(pathToFileURL(out).href);

test("canonical statuses pass through unchanged", () => {
  for (const s of ["verified", "needs_review", "unverified", "expired"]) assert.equal(normalizeVerification(s), s);
});

test("legacy, missing and invalid statuses are never shown as verified", () => {
  for (const s of ["hand_verified", "VERIFIED", "", null, undefined, "garbage"]) {
    assert.equal(normalizeVerification(s), "unverified");
  }
});

test("valid timestamp formats to a readable string", () => {
  assert.notEqual(formatDate("2026-11-19T10:00:00Z"), "—");
});

test("missing or invalid timestamps show a dash, never 'Invalid Date'", () => {
  for (const v of [null, undefined, "", "not a date", "2026-13-45"]) assert.equal(formatDate(v), "—");
});

test("government domains and subdomains are official over https", () => {
  for (const u of ["https://pmkisan.gov.in/", "https://www.tnhorticulture.tn.gov.in/x", "https://tn.nic.in/"]) assert.equal(isGovHttps(u), true, u);
});

test("lookalikes, commercial sites, http and bad input are not official", () => {
  for (const u of ["https://evilgov.in/", "https://pmkisan.gov.in.evil.example/", "https://www.acko.com/x", "http://pmkisan.gov.in/", "", "not a url"]) {
    assert.equal(isGovHttps(u), false, u);
  }
});

test("a guest token is used only before its expiry, with a 30 s safety margin", () => {
  const now = 1_000_000;
  assert.equal(isGuestTokenValid(now + 60_000, now), true);
  assert.equal(isGuestTokenValid(now + 20_000, now), false);   // inside the margin
  assert.equal(isGuestTokenValid(now - 1, now), false);         // already expired
  assert.equal(isGuestTokenValid(null, now), false);
  assert.equal(isGuestTokenValid(undefined, now), false);
  assert.equal(isGuestTokenValid(Number.NaN, now), false);
});
