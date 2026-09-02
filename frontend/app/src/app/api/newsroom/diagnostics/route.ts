import { sessionWithScope } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";

/**
 * The deployment's diagnostics, proxied for the dev account.
 *
 * Thin on purpose: the API decides what a diagnostics report contains and
 * refuses the request on its own if the caller's role is wrong. This adds the
 * scope check in front so a writer who typed the URL gets 403 rather than a
 * round trip, and adds nothing to the body.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const gate = await sessionWithScope("system:diagnostics");
  if (!gate.ok) {
    return Response.json(
      {
        error:
          gate.status === 401
            ? "The newsroom is locked."
            : "Diagnostics are the developer account's screen.",
      },
      { status: gate.status },
    );
  }

  try {
    return Response.json(await newsroomFetch("/newsroom/diagnostics"));
  } catch (cause) {
    return errorResponse(cause);
  }
}
