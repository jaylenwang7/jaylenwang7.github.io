import { ApiError } from "./http";

let cached: { secret: string; key: CryptoKey } | null = null;

async function hmacKey(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) {
    throw new ApiError(500, "internal", "The interaction service is unavailable.");
  }
  if (cached === null || cached.secret !== secret) {
    cached = {
      secret,
      key: await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      ),
    };
  }
  return cached.key;
}

async function hmac(secret: string, value: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function voterHash(
  secret: string,
  subjectId: string,
  visitorId: string,
): Promise<string> {
  return hmac(secret, `like:${subjectId}:${visitorId}`);
}

export function rateKey(secret: string, visitorId: string): Promise<string> {
  return hmac(secret, `rl:${visitorId}`);
}
