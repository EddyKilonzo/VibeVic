import { createHash } from "node:crypto";
import { isUnlocked } from "@/lib/newsroom-auth";
import { errorResponse, newsroomFetch } from "@/lib/newsroom-api";

/**
 * Editing and removing one media item.
 *
 * DELETE does two things in order, and the order is the point: the database row
 * goes first, then the file in Cloudinary. If the second fails the library is
 * still correct — the item is gone from the newsroom's view — and what is left
 * behind is an unreferenced file, which is a billing footnote. Doing it the
 * other way round risks the opposite: a row pointing at a file that no longer
 * exists, which renders as a broken image on a published story.
 */

export const dynamic = "force-dynamic";

interface DeleteResult {
  id: string;
  deleted: boolean;
  /** Null for a linked item, which we never hosted. */
  publicId: string | null;
}

/**
 * Cloudinary's destroy endpoint, signed the same way as an upload.
 *
 * Returns whether the file is gone. Never throws: a failure here must not turn
 * a successful delete into an error for the journalist, so it is logged and
 * reported rather than raised.
 */
async function destroyInCloudinary(publicId: string): Promise<boolean> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.error(`[media/delete] Cloudinary not configured; ${publicId} left in place.`);
    return false;
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHash("sha1")
      .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
      .digest("hex");

    const form = new FormData();
    form.set("public_id", publicId);
    form.set("timestamp", timestamp);
    form.set("api_key", apiKey);
    form.set("signature", signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      { method: "POST", body: form, signal: AbortSignal.timeout(15_000) },
    );

    if (!response.ok) {
      console.error(`[media/delete] Cloudinary returned ${response.status} for ${publicId}`);
      return false;
    }

    // Cloudinary answers 200 with {"result":"not found"} for an id it does not
    // have, which for our purposes is the same as gone.
    const body = (await response.json()) as { result?: string };
    const ok = body.result === "ok" || body.result === "not found";
    if (!ok) console.error(`[media/delete] Cloudinary said "${body.result}" for ${publicId}`);
    return ok;
  } catch (cause) {
    console.error(`[media/delete] destroy failed for ${publicId}:`, cause);
    return false;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await isUnlocked())) {
    return Response.json({ error: "The newsroom is locked." }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  try {
    return Response.json(
      await newsroomFetch(`/newsroom/media/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    );
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await isUnlocked())) {
    return Response.json({ error: "The newsroom is locked." }, { status: 401 });
  }

  const { id } = await params;

  let result: DeleteResult;
  try {
    result = await newsroomFetch<DeleteResult>(
      `/newsroom/media/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  } catch (cause) {
    return errorResponse(cause);
  }

  // The row is gone. The file is a best effort from here, and the response says
  // which — an orphaned file is worth knowing about even though it is not worth
  // failing the request over.
  const fileRemoved = result.publicId ? await destroyInCloudinary(result.publicId) : true;

  return Response.json({ ...result, fileRemoved });
}
