/**
 * Safe byte <-> base64 conversion for large payloads (documents, voice recordings).
 * Never pass a large array as function arguments: that overflows the JS call stack
 * on big inputs (RangeError: Maximum call stack size exceeded). Converts in fixed-size chunks instead.
 */
const CHUNK = 0x8000; // 32 KB per call

export function bytesToBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(binary);
}

/** Throws a clear error for invalid base64 instead of returning garbage bytes. */
export function base64ToBytes(b64: string): Uint8Array {
  if (!b64) return new Uint8Array(0);
  let binary: string;
  try {
    binary = atob(b64);
  } catch {
    throw new Error("Stored data is damaged and cannot be read. Please scan the document again.");
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Blob -> base64 without blocking on a giant string spread. */
export async function blobToBase64(blob: Blob): Promise<string> {
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
}
