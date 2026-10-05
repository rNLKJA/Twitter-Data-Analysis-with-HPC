/** SHA-256 of UTF-8 text as lowercase hex (Web Crypto: browsers and Node 20+). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The hash, or "unavailable" where Web Crypto is not (an insecure origin such
 * as a LAN address over http). Used for audit fields that must never block a call.
 */
export function sha256HexOrUnavailable(text: string): Promise<string> {
  return sha256Hex(text).catch(() => "unavailable");
}
