/**
 * The newsroom session, as this app understands it.
 *
 * ── What replaced what ───────────────────────────────────────────────────
 * This file used to be `newsroom-token.ts`, and it both *issued* and checked
 * a token: one shared passphrase, an HMAC over an expiry and a nonce, and a
 * comment admitting there was no user system behind it. There is one now. The
 * API signs a JWT for a named account with a role, so this app no longer
 * mints credentials at all — it verifies the one the API issued, and that is
 * a strictly smaller job.
 *
 * The signing key is gone from here for the same reason. `NEWSROOM_SECRET`
 * and `NEWSROOM_PASSPHRASE` are not read anywhere any more; the only shared
 * value is `AUTH_JWT_SECRET`, which both processes hold, and only one of them
 * can sign with.
 *
 * ── Why verify here at all, when the API will ────────────────────────────
 * Because the middleware has to answer "may this page render" before there is
 * anything to ask the API about, and a round trip on every navigation to
 * learn what the cookie already says would be a request per click. The API
 * re-checks everything that matters — the account still exists, the role, the
 * revocation clock — on every call that touches data. This check decides
 * whether to draw a screen. That is the same two-lock split the codebase uses
 * everywhere else, with the cheap lock in front.
 *
 * ── Web Crypto, deliberately ─────────────────────────────────────────────
 * `crypto.subtle` runs in middleware, in server actions and in route
 * handlers. `node:crypto` does not run in the first of those, and a second
 * implementation of one signature check is how the two drift apart.
 */

const ENCODER = new TextEncoder();

/**
 * The session cookie's name, which is a security control in production.
 *
 * `__Host-` is not decoration: a browser refuses to accept a cookie by that
 * name unless it is `Secure`, has `Path=/`, and carries no `Domain`. The
 * consequence is the one worth having — no other host can set it. Without the
 * prefix, anything that can write cookies for a sibling subdomain (a staging
 * app, a marketing page, a service on a shared apex) can plant a session
 * cookie that this app will read as its own, which is session fixation with
 * no bug on our side required.
 *
 * Dropped in development because the prefix implies `Secure` and the dev
 * server is plain HTTP. The three attributes it stands for are set explicitly
 * in `signInAction` either way; the prefix is what makes the browser enforce
 * them instead of trusting us to.
 *
 * Renaming this invalidates every session that exists. That happens once, on
 * the deploy that introduces it, and it costs one sign-in.
 */
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-vv_newsroom" : "vv_newsroom";

/** Mirrors `Role` in the API's schema. Two roles, and no third by accident. */
export type NewsroomRole = "WRITER" | "DEV";

export interface SessionClaims {
  /** The account id. The only claim the API itself trusts. */
  sub: string;
  email: string;
  role: NewsroomRole;
  /** Seconds since the epoch, as JWT counts them. */
  iat: number;
  exp: number;
}

/**
 * Verify a session cookie.
 *
 * Returns the claims, or null. Never throws and never distinguishes the ways
 * it can fail: a missing secret, a malformed cookie, a bad signature and an
 * expired token all mean the same thing to every caller — this request is not
 * signed in — and a caller that could tell them apart would eventually branch
 * on the difference.
 *
 * Fails closed on a missing `AUTH_JWT_SECRET`. A misconfigured lock reads as
 * shut, which is the same rule the API applies at boot.
 */
export async function verifySession(
  token: string | undefined,
  now = Date.now(),
): Promise<SessionClaims | null> {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || !token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [rawHeader, rawPayload, rawSignature] = parts;
  if (!rawHeader || !rawPayload || !rawSignature) return null;

  const header = decodeJson(rawHeader);
  // The algorithm is checked against what we expect rather than read from the
  // token and obeyed. Trusting `alg` is how `"alg":"none"` became a famous
  // way into other people's applications.
  if (!header || header.alg !== "HS256") return null;

  const signature = decodeBase64Url(rawSignature);
  if (!signature) return null;

  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(secret),
      signature,
      ENCODER.encode(`${rawHeader}.${rawPayload}`),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  // Only read once the signature says the API wrote it. Parsing first would
  // mean acting on numbers an attacker chose, however briefly.
  const payload = decodeJson(rawPayload);
  if (!payload) return null;

  const { sub, email, role, iat, exp } = payload;
  if (typeof sub !== "string" || typeof email !== "string") return null;
  if (role !== "WRITER" && role !== "DEV") return null;
  if (typeof iat !== "number" || typeof exp !== "number") return null;
  if (exp * 1000 <= now) return null;

  return { sub, email, role, iat, exp };
}

/** How long this session has left, in seconds. Never negative. */
export function secondsRemaining(claims: SessionClaims, now = Date.now()): number {
  return Math.max(0, claims.exp - Math.floor(now / 1000));
}

async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

/**
 * base64url → bytes.
 *
 * `atob` speaks base64, not base64url, so the two substitutions and the
 * padding have to be put back by hand. A malformed segment throws inside
 * `atob`; it is caught and becomes null, because a cookie is arbitrary input
 * from the network and an exception here would be a 500 on the sign-in page.
 */
function decodeBase64Url(value: string): ArrayBuffer | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const binary = atob(padded);
    // An ArrayBuffer rather than a view of one, because `crypto.subtle.verify`
    // is typed against a buffer whose backing store cannot be shared, and a
    // Uint8Array is not — it might be a view onto a SharedArrayBuffer.
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes.buffer;
  } catch {
    return null;
  }
}

function decodeJson(segment: string): Record<string, unknown> | null {
  const bytes = decodeBase64Url(segment);
  if (!bytes) return null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
