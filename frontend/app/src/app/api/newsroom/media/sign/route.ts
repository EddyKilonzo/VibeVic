import { createHash } from "node:crypto";
import { isUnlocked } from "@/lib/newsroom-auth";
import { UPLOAD_FOLDER } from "@/lib/cloudinary";

/**
 * Mints a signature so the browser can upload straight to Cloudinary.
 *
 * ── Why the file does not come through here ──────────────────────────────
 * A serverless function that proxies uploads pays for every byte twice, is
 * bounded by the platform's request-body limit, and turns a slow phone upload
 * into a held-open function invocation. Signing instead means this route
 * handles a few hundred bytes and the file goes browser → Cloudinary directly.
 *
 * ── What is actually secret ──────────────────────────────────────────────
 * The API secret, and only the API secret. The cloud name is in every delivery
 * URL the site serves, and the API key travels to the browser as part of the
 * signed request by design — Cloudinary needs it to identify the account. The
 * secret never leaves this process: it is used to hash and is never returned.
 *
 * The signature covers the folder, so a leaked signature cannot be used to
 * write outside `vibevic/`, and it expires with its timestamp — Cloudinary
 * rejects signatures older than an hour.
 */

export const dynamic = "force-dynamic";

/**
 * Cloudinary's signing rule: every signed parameter sorted by key, joined as
 * `k=v` with `&`, with the API secret appended, then SHA-1. Getting the sort or
 * the set of included keys wrong produces a signature Cloudinary rejects with a
 * message that does not say which, so the set is kept deliberately small.
 */
function sign(params: Record<string, string>, secret: string): string {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(`${canonical}${secret}`).digest("hex");
}

export async function POST(): Promise<Response> {
  if (!(await isUnlocked())) {
    return Response.json({ error: "The newsroom is locked." }, { status: 401 });
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    // 501 rather than 500: nothing is broken, the account was never configured.
    // Naming the missing variables is the difference between a five-second fix
    // and an afternoon in the wrong file.
    const missing = [
      !cloudName && "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
      !apiKey && "CLOUDINARY_API_KEY",
      !apiSecret && "CLOUDINARY_API_SECRET",
    ].filter(Boolean);

    console.error(`[media/sign] not configured; missing ${missing.join(", ")}`);
    return Response.json(
      {
        error: `Cloudinary is not configured. Set ${missing.join(", ")} in frontend/app/.env.local and restart.`,
      },
      { status: 501 },
    );
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Only the folder is signed alongside the timestamp. Every additional
    // signed parameter is one the client must echo back byte-for-byte, and a
    // mismatch is an opaque 401 from Cloudinary — so the set stays minimal and
    // the constraint we actually care about (where files may land) is kept.
    const params = { folder: UPLOAD_FOLDER, timestamp };

    return Response.json({
      cloudName,
      apiKey,
      timestamp,
      folder: UPLOAD_FOLDER,
      signature: sign(params, apiSecret),
    });
  } catch (cause) {
    // Hashing does not realistically fail, but a route that can throw and does
    // not say so leaves the uploader with an unparseable response.
    console.error("[media/sign]", cause);
    return Response.json(
      { error: "The upload could not be authorised. Nothing was sent." },
      { status: 500 },
    );
  }
}
