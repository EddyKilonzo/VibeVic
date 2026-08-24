import { isUnlocked } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";

/**
 * The media library, proxied.
 *
 * Same shape and same reason as `/api/newsroom/stories`: the API wants a bearer
 * token, and a token the browser could read is a published token. The browser
 * asks this route, this route holds the credential.
 *
 * GET lists the library. POST records a file the browser has already uploaded
 * to Cloudinary — the bytes went straight there against a signature from
 * `./sign`, so what travels here is a small JSON receipt.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!(await isUnlocked())) {
    return Response.json({ error: "The newsroom is locked." }, { status: 401 });
  }

  try {
    return Response.json(await newsroomFetch("/newsroom/media"));
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!(await isUnlocked())) {
    return Response.json({ error: "The newsroom is locked." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  try {
    const created = await newsroomFetch("/newsroom/media", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return Response.json(created, { status: 201 });
  } catch (cause) {
    // Worth being loud about: the file is already in Cloudinary at this point,
    // so a failure here leaves an asset nothing references. The uploader tells
    // the journalist as much rather than pretending the upload failed.
    return errorResponse(cause);
  }
}
