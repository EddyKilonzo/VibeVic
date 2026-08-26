import { isUnlocked } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";
import type { PortfolioClass } from "@/data/newsroom/types";

/**
 * How the journalist classes their own work.
 *
 * A map from story id to one of four values — standard, signature,
 * investigation, award submission. It is curation rather than a record, which
 * is why it is not one of the eleven collections behind
 * `/api/newsroom/records`: there is no row with an id and a timestamp, only a
 * property a story either has or does not.
 *
 * ── Why PUT, and why there is no POST ────────────────────────────────────
 * Setting a class twice is the same statement made twice, not two records, so
 * the API keys it by story id and answers idempotently. A retry after a dropped
 * connection is therefore free — which is the whole reason PUT exists and the
 * reason this proxy does not invent a POST alias for it.
 *
 * ── Vocabulary ───────────────────────────────────────────────────────────
 * The API speaks `AWARD_SUBMISSION`; the app has always spelled it
 * `award-submission`, and `PortfolioClass` in `data/newsroom/types` is written
 * that way. Same split, same resolution, and the same reason as
 * `newsroom-records.ts`: the translation happens on this side so the browser
 * never meets a Prisma enum.
 */

export const dynamic = "force-dynamic";

const LOCKED = { error: "The newsroom is locked." } as const;

const CLASSES: readonly PortfolioClass[] = [
  "standard",
  "signature",
  "investigation",
  "award-submission",
];

function toApp(value: string): PortfolioClass {
  return value.toLowerCase().replace(/_/g, "-") as PortfolioClass;
}

function toApi(value: string): string {
  return value.toUpperCase().replace(/-/g, "_");
}

export async function GET(): Promise<Response> {
  if (!(await isUnlocked())) return Response.json(LOCKED, { status: 401 });

  try {
    const rows = await newsroomFetch<Record<string, string>>("/newsroom/portfolio");
    const map: Record<string, PortfolioClass> = {};
    for (const [storyId, value] of Object.entries(rows)) map[storyId] = toApp(value);
    return Response.json(map);
  } catch (cause) {
    return errorResponse(cause);
  }
}

/**
 * Sets or clears one story's class.
 *
 * Both verbs on one route rather than two files, because the pair is one idea:
 * `class: null` is "this piece is not classed", which the API spells as a
 * DELETE. Sending an enum it does not know would otherwise reach it as a 400
 * naming a Prisma value the journalist has never seen, so the allowlist check
 * happens here where the app's own vocabulary is the one being checked.
 */
export async function PUT(request: Request): Promise<Response> {
  if (!(await isUnlocked())) return Response.json(LOCKED, { status: 401 });

  let body: { storyId?: unknown; class?: unknown };
  try {
    body = (await request.json()) as { storyId?: unknown; class?: unknown };
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  const storyId = typeof body.storyId === "string" ? body.storyId.trim() : "";
  if (!storyId) {
    return Response.json({ error: "No story was named." }, { status: 400 });
  }

  const path = `/newsroom/portfolio/${encodeURIComponent(storyId)}`;

  // Clearing is a DELETE on the API. Modelled here as `class: null` because
  // that is what the screen has in hand — a select whose empty option means
  // "no class" — and turning that into a second request shape at the call site
  // would put the API's URL layout into a component.
  if (body.class === null) {
    try {
      return Response.json(await newsroomFetch(path, { method: "DELETE" }));
    } catch (cause) {
      return errorResponse(cause);
    }
  }

  if (typeof body.class !== "string" || !CLASSES.includes(body.class as PortfolioClass)) {
    return Response.json(
      { error: `A portfolio class must be one of: ${CLASSES.join(", ")}.` },
      { status: 400 },
    );
  }

  try {
    const set = await newsroomFetch<{ storyId: string; class: string }>(path, {
      method: "PUT",
      body: JSON.stringify({ class: toApi(body.class) }),
    });
    return Response.json({ storyId: set.storyId, class: toApp(set.class) });
  } catch (cause) {
    return errorResponse(cause);
  }
}
