import { timingSafeEqual } from "node:crypto";

/**
 * The scheduler's hop from Vercel to the API.
 *
 * ── Why the cron lands here and not on the API directly ──────────────────
 * Vercel's cron can only call a path on the deployment it belongs to, and the
 * API is a separate service. So this route is the hop: it authenticates the
 * platform on the way in, and presents the API's own shared secret on the way
 * out.
 *
 * Two secrets rather than one, deliberately. `CRON_SECRET` is Vercel's — the
 * platform sends it as a bearer token and it proves the caller is the
 * scheduler rather than anybody who found this path. `NEWSROOM_CRON_KEY` is
 * the API's, and it never reaches the browser or the platform's own
 * configuration UI for the other project. Sharing one value across both would
 * mean a leak on either side opened the other.
 *
 * ── Not configured is a refusal ──────────────────────────────────────────
 * Both missing secrets answer 501, matching `NewsroomGuard.admitScheduler`:
 * an unconfigured control is a closed door, not an absent one. A deployment
 * with no scheduler set up should not have an open endpoint that runs the
 * newsroom's mail.
 */

export const dynamic = "force-dynamic";
/**
 * The pass sends one email per writer and does two sweeps. Well inside the
 * Hobby plan's 60-second ceiling, which is the real limit here — asking for
 * more is not clamped, it fails the deployment.
 */
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const platformSecret = process.env.CRON_SECRET;
  const apiKey = process.env.NEWSROOM_CRON_KEY;

  if (!platformSecret || !apiKey) {
    return Response.json(
      {
        error:
          "No scheduler is configured. Set CRON_SECRET and NEWSROOM_CRON_KEY to enable reminders.",
      },
      { status: 501 },
    );
  }

  /*
   * Vercel sends `Authorization: Bearer <CRON_SECRET>`. Compared in constant
   * time for the same reason the API compares its own that way: this path is
   * unauthenticated by definition and can be called as often as anybody likes,
   * which is the one situation where a timing difference is worth having.
   */
  const offered = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!matches(offered, platformSecret)) {
    return Response.json({ error: "Not the scheduler." }, { status: 401 });
  }

  const base = (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000/api"
  ).replace(/\/+$/, "");

  try {
    const response = await fetch(`${base}/system/reminders/run`, {
      method: "POST",
      headers: { "x-vv-cron-key": apiKey, Accept: "application/json" },
      cache: "no-store",
      // Shorter than `maxDuration`, so a hung API becomes a sentence in the
      // cron log rather than a function the platform kills with no handler —
      // the same two-clocks argument the pitch route makes at length.
      signal: AbortSignal.timeout(45_000),
    });

    const body = await response.json().catch(() => null);
    return Response.json(body ?? { ok: response.ok }, { status: response.status });
  } catch {
    return Response.json(
      { error: "The API could not be reached. No reminders were sent." },
      { status: 502 },
    );
  }
}

/** Constant-time string comparison that does not throw on a length mismatch. */
function matches(offered: string, expected: string): boolean {
  const a = Buffer.from(offered);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
