import { isUnlocked } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";
import { toApiCreate, toStory, toSummary, type AdminStoryRow } from "@/lib/story-records";
import type { Story } from "@/data/types";

/**
 * The admin story list, and the route that creates one.
 *
 * The API's `/admin/stories` returns drafts and scheduled pieces, and it wants
 * a bearer token. That token cannot go anywhere the browser can read it, which
 * rules out calling the API directly from `data/api.ts` — a `NEXT_PUBLIC_`
 * credential is a published credential. So the credential lives here, in a
 * handler the browser can only ask, never inspect.
 *
 * ── Two locks, same as the pitch desk ────────────────────────────────────
 * The middleware matcher covers `/api/newsroom/:path*`, so this is already
 * gated by the time it runs. `isUnlocked` is the second check, for the same
 * reason it is there: a matcher is configuration, a route can be moved, and
 * the failure mode of getting either wrong is an unauthenticated window onto
 * unpublished work.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!(await isUnlocked())) {
    return Response.json({ error: "The newsroom is locked." }, { status: 401 });
  }

  try {
    const rows = await newsroomFetch<AdminStoryRow[]>("/admin/stories");
    return Response.json(rows.map(toSummary));
  } catch (cause) {
    return errorResponse(cause);
  }
}

/**
 * A slug the API will accept, derived from the headline.
 *
 * ── Why the editor does not ask for one ──────────────────────────────────
 * A slug is a permanent decision — it is the article's address, and the API
 * refuses to change it afterwards for the reason it should: every link a
 * reader saved and every canonical URL already in an index points at it. Asking
 * a writer to commit to that in the first thirty seconds of a draft, before the
 * headline has settled, gets the decision made at the worst possible moment.
 *
 * So it is derived from the title on the one request that sets it, and the
 * suffix is not decoration: two pieces can legitimately share a headline —
 * a weekly column, a follow-up — and the API answers 409 on a duplicate. A
 * four-character suffix turns a hard failure the writer cannot act on into a
 * distinct address.
 */
function slugFor(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140)
    // A trailing hyphen from the slice would fail the API's own pattern, which
    // requires words separated by *single* hyphens with nothing hanging off
    // either end.
    .replace(/-+$/, "");

  // "untitled" rather than an empty string: the API's pattern rejects empty,
  // and a draft saved before the headline exists is the ordinary case, not an
  // error worth refusing the save over.
  const stem = base || "untitled";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${stem}-${suffix}`;
}

export async function POST(request: Request): Promise<Response> {
  if (!(await isUnlocked())) {
    return Response.json({ error: "The newsroom is locked." }, { status: 401 });
  }

  let story: Story;
  try {
    story = (await request.json()) as Story;
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  // Checked here rather than left to the API's 400, which would name `title`
  // and `dek` as validation failures on a draft the writer has barely begun.
  // An untitled draft is a normal thing to have; an untitled *record* is not,
  // because the stories list would show a blank row nobody can identify.
  if (typeof story?.title !== "string" || !story.title.trim()) {
    return Response.json(
      { error: "Give the piece a headline before it can be filed. It saves on this device meanwhile." },
      { status: 400 },
    );
  }

  try {
    const created = await newsroomFetch<AdminStoryRow>("/admin/stories", {
      method: "POST",
      body: JSON.stringify(toApiCreate(story, slugFor(story.title))),
    });
    return Response.json(toStory(created), { status: 201 });
  } catch (cause) {
    return errorResponse(cause);
  }
}
