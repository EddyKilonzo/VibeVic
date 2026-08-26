import { isUnlocked } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";

/**
 * The reader figures, for the newsroom.
 *
 * Gated, unlike the endpoint that writes them. Anybody's browser may add to the
 * ledger — readers have no accounts and never will, so a credential is not
 * available for the write — but only the newsroom may read the totals. Exposing
 * them publicly would let anybody watch how a piece is travelling, which is the
 * journalist's business and nobody else's.
 *
 * A story nobody has opened is absent from this list rather than present with
 * zeros, and the screens are written against that distinction: "no data yet"
 * and "nobody read it" are different sentences and only one of them is ever
 * true this early.
 */

export const dynamic = "force-dynamic";

export interface StoryFigures {
  storyId: string;
  slug: string;
  title: string;
  views: number;
  reads: number;
  listens: number;
  avgListenSeconds: number;
  updatedAt: string;
}

export async function GET(): Promise<Response> {
  if (!(await isUnlocked())) {
    return Response.json({ error: "The newsroom is locked." }, { status: 401 });
  }

  try {
    return Response.json(await newsroomFetch<StoryFigures[]>("/newsroom/analytics"));
  } catch (cause) {
    return errorResponse(cause);
  }
}
