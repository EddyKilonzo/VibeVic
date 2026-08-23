/**
 * The newsroom session token.
 *
 * ── What was wrong with the old cookie ───────────────────────────────────
 * It held SHA-256 of the passphrase, and the gate compared that against the
 * same hash recomputed per request. Three consequences, none of them
 * obvious from reading the sign-in form:
 *
 *   1. The cookie *was* the credential. Not a token derived from a session —
 *      a deterministic function of the secret, identical for every sign-in on
 *      every device. Anything that ever saw one value had a permanent key.
 *   2. It could not expire. `maxAge` asks the browser to forget it, which is
 *      a request to the client, not a rule on the server. A copy taken out of
 *      a backup, a synced profile or a shared machine stayed valid.
 *   3. It could not be revoked without changing the passphrase for everyone.
 *
 * A signed token fixes all three: the server states the expiry inside the
 * value and signs it, so a cookie that outlives its window is refused by the
 * gate rather than trusted because the browser still had it.
 *
 * ── Web Crypto, deliberately ─────────────────────────────────────────────
 * `crypto.subtle` is available in middleware, in server actions and in route
 * handlers. `node:crypto` is not available in the first of those, and three
 * implementations of one comparison is how they drift apart.
 */

const ENCODER = new TextEncoder();

/**
 * The signing key.
 *
 * Derived from the passphrase unless `NEWSROOM_SECRET` is set, which means
 * rotating the passphrase invalidates every session that exists — the
 * behaviour you want from "change the locks", and the one people assume they
 * are getting. Set the separate secret when you would rather sessions
 * survive a passphrase change.
 */
function secretMaterial(): string | null {
  return process.env.NEWSROOM_SECRET || process.env.NEWSROOM_PASSPHRASE || null;
}

async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Twelve hours — one working day, not forever. */
export const SESSION_SECONDS = 60 * 60 * 12;

/**
 * `expiry.nonce.signature`
 *
 * The nonce makes two sessions issued in the same second distinct, so a
 * token is per-sign-in rather than per-passphrase. It carries no meaning and
 * is never looked up — there is no session store to look it up in.
 */
export async function issueToken(now = Date.now()): Promise<string | null> {
  const secret = secretMaterial();
  if (!secret) return null;

  const expiresAt = Math.floor(now / 1000) + SESSION_SECONDS;
  const nonce = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const body = `${expiresAt}.${nonce}`;
  const signature = toHex(await crypto.subtle.sign("HMAC", await signingKey(secret), ENCODER.encode(body)));

  return `${body}.${signature}`;
}

/**
 * Constant-time string comparison.
 *
 * `===` on a signature leaks how much of it was right through how long the
 * mismatch took to find. `crypto.subtle.verify` would do this for us, and is
 * used below; this exists for the length check that has to happen first.
 */
export async function verifyToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  const secret = secretMaterial();
  // Fail closed. A missing secret is a misconfiguration, and the safe reading
  // of a misconfigured lock is "shut".
  if (!secret || !token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [rawExpiry, nonce, signature] = parts;
  const expiresAt = Number(rawExpiry);
  if (!Number.isFinite(expiresAt) || !/^[a-f0-9]{16}$/.test(nonce)) return false;

  // Expiry is checked before the signature is verified, and again after: the
  // cheap test first so an expired token costs nothing, and the value is only
  // trusted once the signature says the server wrote it.
  if (expiresAt * 1000 <= now) return false;

  const bytes = signature.match(/../g);
  if (!bytes || bytes.length !== 32 || !/^[a-f0-9]{64}$/.test(signature)) return false;

  const valid = await crypto.subtle.verify(
    "HMAC",
    await signingKey(secret),
    new Uint8Array(bytes.map((byte) => parseInt(byte, 16))),
    ENCODER.encode(`${rawExpiry}.${nonce}`),
  );

  return valid && expiresAt * 1000 > now;
}
