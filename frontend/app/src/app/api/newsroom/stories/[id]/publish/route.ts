import { revalidatePath } from "next/cache";

import { isUnlocked } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";
import { toStory, type AdminStoryRow } from "@/lib/story-records";

/**
 * Putting a story on the site, setting it to appear later, or pulling it back.
 *
 * ── Why the transition lives here and not in the editor's autosave ───────
 * `story-records.ts` keeps `status` out of every ordinary write, and the
 * reason survives the API implementing this: a PATCH carrying
 * `status: "PUBLISHED"` and a past `publishedAt` satisfies the API's
 * `publishedWhere` exactly, which would mean the editor's autosave could put a
 * piece in front of readers as a side effect of typing. So the words go
 * through the record route and the decision goes through this one, which asks
 * the server whose job it is and relays what it says.
 *
 * ── Three verbs, one route ───────────────────────────────────────────────
 * `publish`, `schedule` and `unpublish` are the same decision — where this
 * piece sits relative to the public — so they share the route, the canonical
 * check behind it and the date rule. The body is optional and an absent one
 * means publish, which is what a bare POST from a "Publish" button should do.
 *
 * The body is forwarded rather than rebuilt. Every field in it is validated by
 * `PublishStoryDto` on the API with `forbidNonWhitelisted`, so an unrecognised
 * property is a 400 there rather than something this proxy has to know about —
 * and a proxy that reassembles a payload is a second place that has to be
 * taught each time the first one learns a new verb.
 */

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await isUnlocked())) {
    return Response.json({ error: "The newsroom is locked." }, { status: 401 });
  }

  const { id } = await params;

  /*
   * An empty body is the ordinary case — the publish button posts nothing —
   * and `request.json()` throws on it rather than returning undefined. Treated
   * as `{}` so the API applies its own default of `publish`, which keeps the
   * two ends agreeing about what a bare POST means instead of this route
   * inventing an action the server would then re-derive.
   */
  const body = await request.json().catch(() => ({}));

  try {
    /*
     * A longer budget than the default, because this request is genuinely
     * more work than a read.
     *
     * Publishing runs the canonical check, writes the transition and takes the
     * conditional-update path, and it is the request most likely to be the
     * first thing to touch a Neon instance that has gone to sleep. The default
     * 15s was losing it: the dev log carries a real `POST
     * /admin/stories/…/publish failed: TimeoutError` against a piece that is
     * still sitting as a draft, which is a writer having pressed Publish and
     * been told the newsroom could not be reached.
     *
     * Not unbounded, and the ceiling is not ours to choose: the deployment's
     * functions are cut off at 60s, so a budget above that would be a promise
     * the platform overrides with a worse error than this one. 30s leaves room
     * for the answer and room for this route to return it.
     */
    const published = await newsroomFetch<AdminStoryRow>(
      `/admin/stories/${encodeURIComponent(id)}/publish`,
      { method: "POST", body: JSON.stringify(body), timeoutMs: 30_000 },
    );
    const story = toStory(published);
    revalidatePublicPages(story.slug);
    return Response.json(story);
  } catch (cause) {
    return errorResponse(cause);
  }
}

/**
 * Drop the reader-facing pages this decision changed.
 *
 * The article route is the one that genuinely breaks without this. It is
 * prerendered from the list `generateStaticParams` read at build time, so
 * until the path is revalidated a piece published since the last deploy is
 * served from a cache that predates it — and, before `dynamicParams` was
 * turned back on, was a hard 404 at the very address the writer had just
 * pasted into a message. Unpublishing has the mirror problem: the page stays
 * warm and keeps serving a piece that has been pulled.
 *
 * The listings — the archive, the beats, the feed — are refreshed too. They
 * would come right on their own within the minute their reads are cached for,
 * but "within the minute" is not what someone checks after pressing Publish,
 * and a headline that appears on the site while the index still omits it reads
 * as a half-finished publish rather than a cache.
 *
 * Failure here is logged and swallowed. The transition is already committed on
 * the API; turning a stale cache into a failed publish would tell the writer
 * the opposite of what happened, and the next revalidation clears it anyway.
 */
function revalidatePublicPages(slug: string): void {
  try {
    revalidatePath(`/stories/${slug}`);
    revalidatePath("/stories");
    revalidatePath("/beats/[slug]", "page");
    revalidatePath("/sitemap.xml");
    revalidatePath("/rss.xml");
  } catch (cause) {
    console.error("[publish] could not revalidate the public pages:", cause);
  }
}
