import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Is this request coming from inside the newsroom?
 *
 * ── Why a route needs its own check at all ───────────────────────────────
 * `middleware.ts` guards `/admin/:path*`, and that is the whole matcher. An
 * API route under `/api` is therefore wide open no matter what it does, which
 * is fine for a route that reads published data and emphatically not fine for
 * one that spends money on a language model. Anybody who found the path could
 * run up a bill.
 *
 * The comparison is the same one the sign-in form makes: SHA-256 of the
 * configured passphrase against the cookie, through `timingSafeEqual`. The
 * cookie is httpOnly and holds the hash rather than the secret, so this is
 * checking the same artefact the gate issued and nothing else.
 *
 * Fail-closed, like the middleware: with no `NEWSROOM_PASSPHRASE` configured
 * this returns false rather than waving everything through.
 */
const COOKIE = "vv_newsroom";

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function isUnlocked(): Promise<boolean> {
  const passphrase = process.env.NEWSROOM_PASSPHRASE;
  if (!passphrase) return false;

  const presented = (await cookies()).get(COOKIE)?.value;
  if (!presented) return false;

  const a = Buffer.from(digest(passphrase));
  const b = Buffer.from(presented);
  return a.length === b.length && timingSafeEqual(a, b);
}
