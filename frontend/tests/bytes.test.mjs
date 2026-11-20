// Frontend unit tests for the large-payload helpers. Uses Node's built-in test runner (no extra framework).
// Run: npm test   (bundles src/lib/bytes.ts with esbuild, which Vite already provides)
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "bytes-"));
const out = join(dir, "bytes.mjs");
await build({ entryPoints: ["src/lib/bytes.ts"], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "silent" });
const { bytesToBase64, base64ToBytes, blobToBase64 } = await import(pathToFileURL(out).href);

test("small payload round-trips", () => {
  const b = new Uint8Array([0, 1, 2, 250, 255]);
  assert.deepEqual(base64ToBytes(bytesToBase64(b)), b);
});

test("empty payload gives empty string and empty bytes", () => {
  assert.equal(bytesToBase64(new Uint8Array(0)), "");
  assert.equal(base64ToBytes("").length, 0);
});

test("payload over 100 KB does not overflow the stack and round-trips", () => {
  const b = new Uint8Array(150_000).map((_, i) => (i * 31) & 255);
  assert.deepEqual(base64ToBytes(bytesToBase64(b)), b);
});

test("around 1 MB round-trips", () => {
  const b = new Uint8Array(1_048_576).map((_, i) => (i * 7) & 255);
  const back = base64ToBytes(bytesToBase64(b));
  assert.equal(back.length, b.length);
  assert.deepEqual(back.subarray(0, 1000), b.subarray(0, 1000));
  assert.equal(back[back.length - 1], b[b.length - 1]);
});

test("invalid base64 gives a clear error, not garbage bytes", () => {
  assert.throws(() => base64ToBytes("!!!not base64***"), /damaged/);
});

test("blob to base64 works for large blobs", async () => {
  const b = new Uint8Array(200_000).map((_, i) => i & 255);
  const b64 = await blobToBase64(new Blob([b]));
  assert.deepEqual(base64ToBytes(b64), b);
});
