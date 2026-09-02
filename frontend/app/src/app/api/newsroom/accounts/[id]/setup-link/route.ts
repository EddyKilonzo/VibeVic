import { sessionWithScope } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";

/**
 * Send somebody the single-use link that sets their password.
 *
 * POST, because it mints a credential and sends an email — a GET that does
 * either is a GET a link-prefetcher can fire. The link itself goes to the
 * account's own address and never comes back in this response.
 */

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const gate = await sessionWithScope("system:accounts");
  if (!gate.ok) {
    return Response.json(
      {
        error:
          gate.status === 401
            ? "The newsroom is locked."
            : "Accounts are the developer account's screen.",
      },
      { status: gate.status },
    );
  }

  const { id } = await params;

  try {
    return Response.json(
      await newsroomFetch(`/newsroom/accounts/${encodeURIComponent(id)}/setup-link`, {
        method: "POST",
      }),
    );
  } catch (cause) {
    return errorResponse(cause);
  }
}
