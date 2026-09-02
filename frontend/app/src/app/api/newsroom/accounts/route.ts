import { sessionWithScope } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";

/**
 * Accounts: who can sign in, and adding somebody who cannot yet.
 *
 * ── What never comes back through here ───────────────────────────────────
 * A setup link. The API emails it and does not return it — see `issueFor` in
 * the API's `PasswordResetService` for why that is the control rather than an
 * inconvenience — so there is no token for this proxy to handle, log, or put
 * in a response somebody screenshots.
 */

export const dynamic = "force-dynamic";

const REFUSAL = {
  401: "The newsroom is locked.",
  403: "Accounts are the developer account's screen.",
} as const;

export async function GET(): Promise<Response> {
  const gate = await sessionWithScope("system:accounts");
  if (!gate.ok) return Response.json({ error: REFUSAL[gate.status] }, { status: gate.status });

  try {
    return Response.json(await newsroomFetch("/newsroom/accounts"));
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function POST(request: Request): Promise<Response> {
  const gate = await sessionWithScope("system:accounts");
  if (!gate.ok) return Response.json({ error: REFUSAL[gate.status] }, { status: gate.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  try {
    // Forwarded unexamined: the API's DTO validates the shape, and a second
    // opinion here would be one more place the two could disagree about what
    // a valid role is.
    return Response.json(
      await newsroomFetch("/newsroom/accounts", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  } catch (cause) {
    return errorResponse(cause);
  }
}
