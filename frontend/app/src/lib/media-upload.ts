"use client";

import type { MediaKind } from "./media";

/**
 * The upload path, from the browser's side.
 *
 * Three steps, and each one can fail differently:
 *
 *   1. ask our server to sign an upload  → the newsroom may be locked, or
 *      Cloudinary may not be configured;
 *   2. send the file to Cloudinary       → the network, the file size, the
 *      account's limits;
 *   3. record the result in our database → the file now exists and is not yet
 *      referenced by anything.
 *
 * Step 3 is the one worth being careful about, and it is why `uploadMedia`
 * reports which step failed rather than a single boolean. A failure at 1 or 2
 * means nothing happened. A failure at 3 means the file is in Cloudinary and
 * the library does not know — recoverable by retrying, because the API records
 * by public id and will reconcile rather than duplicate.
 */

/**
 * What the media library stores, as the API returns it.
 *
 * `kind` and `source` are the Prisma enum values, which are upper case on the
 * wire. Typing them as the UI's lower-case `MediaKind` would have compiled and
 * then compared "VIDEO" against "video" at runtime, so every clip would have
 * rendered as a still.
 */
export interface MediaAsset {
  id: string;
  kind: "IMAGE" | "VIDEO";
  source: "UPLOAD" | "LINK";
  name: string;
  alt: string;
  publicId: string | null;
  url: string;
  bytes: number | null;
  width: number | null;
  height: number | null;
  format: string | null;
  createdAt: string;
  updatedAt: string;
}

export class UploadError extends Error {
  constructor(
    message: string,
    /** Which step failed — `record` means the file did reach Cloudinary. */
    readonly step: "sign" | "upload" | "record",
  ) {
    super(message);
    this.name = "UploadError";
  }
}

interface Signature {
  cloudName: string;
  apiKey: string;
  timestamp: string;
  folder: string;
  signature: string;
}

async function errorText(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null) {
      const record = body as { error?: unknown; message?: unknown };
      if (typeof record.error === "string") return record.error;
      if (typeof record.message === "string") return record.message;
    }
  } catch {
    // Non-JSON body. The fallback carries the meaning.
  }
  return fallback;
}

/**
 * Uploads one file and records it.
 *
 * `onProgress` is driven by XMLHttpRequest rather than fetch, which still has
 * no upload-progress event. A progress bar matters here more than the tidier
 * API does: these are photographs from a phone on Kenyan mobile data, and an
 * upload with no feedback reads as a frozen page.
 */
export async function uploadMedia(
  file: File,
  kind: MediaKind,
  onProgress?: (fraction: number) => void,
): Promise<MediaAsset> {
  // ── 1. Signature ───────────────────────────────────────────────────────
  let signed: Signature;
  try {
    const response = await fetch("/api/newsroom/media/sign", {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new UploadError(
        await errorText(response, "The upload could not be authorised."),
        "sign",
      );
    }
    signed = (await response.json()) as Signature;
  } catch (cause) {
    if (cause instanceof UploadError) throw cause;
    throw new UploadError("Could not reach the newsroom to authorise the upload.", "sign");
  }

  // ── 2. Straight to Cloudinary ──────────────────────────────────────────
  // `image/upload` handles stills; video goes to the video endpoint, which
  // accepts the same signed parameters.
  const endpoint = `https://api.cloudinary.com/v1_1/${signed.cloudName}/${
    kind === "video" ? "video" : "image"
  }/upload`;

  const form = new FormData();
  form.set("file", file);
  form.set("api_key", signed.apiKey);
  form.set("timestamp", signed.timestamp);
  form.set("folder", signed.folder);
  form.set("signature", signed.signature);

  const uploaded = await new Promise<{
    public_id: string;
    secure_url: string;
    bytes?: number;
    width?: number;
    height?: number;
    format?: string;
  }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", endpoint);
    request.timeout = 120_000;

    if (onProgress) {
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total);
      };
    }

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        try {
          resolve(JSON.parse(request.responseText));
        } catch {
          reject(new UploadError("Cloudinary's answer could not be read.", "upload"));
        }
        return;
      }
      // Cloudinary puts a usable sentence in {"error":{"message":...}}.
      let detail = `Cloudinary refused the upload (${request.status}).`;
      try {
        const body = JSON.parse(request.responseText) as { error?: { message?: string } };
        if (body.error?.message) detail = body.error.message;
      } catch {
        /* keep the status-based message */
      }
      reject(new UploadError(detail, "upload"));
    };

    request.onerror = () =>
      reject(new UploadError("The upload failed. Check your connection.", "upload"));
    request.ontimeout = () =>
      reject(new UploadError("The upload timed out. Try a smaller file.", "upload"));

    request.send(form);
  });

  // ── 3. Record it ───────────────────────────────────────────────────────
  try {
    const response = await fetch("/api/newsroom/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        kind: kind === "video" ? "VIDEO" : "IMAGE",
        source: "UPLOAD",
        name: file.name,
        publicId: uploaded.public_id,
        url: uploaded.secure_url,
        bytes: uploaded.bytes,
        width: uploaded.width,
        height: uploaded.height,
        format: uploaded.format,
      }),
    });

    if (!response.ok) {
      throw new UploadError(
        await errorText(response, "The file uploaded but could not be saved to the library."),
        "record",
      );
    }
    return (await response.json()) as MediaAsset;
  } catch (cause) {
    if (cause instanceof UploadError) throw cause;
    throw new UploadError(
      "The file uploaded but the library could not be reached. Try again — it will not upload twice.",
      "record",
    );
  }
}

/** Records something already hosted elsewhere. No bytes are copied. */
export async function linkMedia(
  url: string,
  kind: MediaKind,
  name: string,
): Promise<MediaAsset> {
  try {
    const response = await fetch("/api/newsroom/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        kind: kind === "video" ? "VIDEO" : "IMAGE",
        source: "LINK",
        name,
        url,
      }),
    });
    if (!response.ok) {
      throw new UploadError(await errorText(response, "That link could not be saved."), "record");
    }
    return (await response.json()) as MediaAsset;
  } catch (cause) {
    if (cause instanceof UploadError) throw cause;
    throw new UploadError("Could not reach the newsroom to save that link.", "record");
  }
}

/**
 * A library request, with the failure `fetch` does not name for you.
 *
 * The three functions below used to call `fetch` bare. A refusal was handled —
 * `response.ok` was checked and `errorText` pulled the handler's own sentence
 * out — but a *rejection* was not, and those are the two different things that
 * go wrong. `fetch` rejects when the request never happened at all: no network,
 * DNS gone, the dev server restarted mid-click. What surfaced then was
 * `TypeError: Failed to fetch`, rendered verbatim into a toast in front of a
 * journalist, and the flat contradiction of the one rule this admin keeps —
 * that a message tells you what happened and what to do about it.
 *
 * Doing it here rather than at the three call sites means the timeout and the
 * wording cannot drift apart, which is what happened the first time.
 */
async function libraryRequest(
  path: string,
  init: RequestInit,
  refused: string,
  unreachable: string,
  timeoutMs = 15_000,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    // A deadline and a dead connection lead to different next steps: one is
    // worth repeating unchanged, the other is not until something has changed.
    const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
    throw new Error(
      timedOut ? "The media library took too long to answer. Try again." : unreachable,
    );
  }

  if (!response.ok) throw new Error(await errorText(response, refused));
  return response;
}

export async function listMediaAssets(): Promise<MediaAsset[]> {
  const response = await libraryRequest(
    "/api/newsroom/media",
    {},
    "The media library could not be loaded.",
    "Could not reach the media library.",
  );

  try {
    return (await response.json()) as MediaAsset[];
  } catch {
    throw new Error("The media library's answer could not be read.");
  }
}

export async function removeMediaAsset(id: string): Promise<void> {
  await libraryRequest(
    `/api/newsroom/media/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    "That item could not be removed.",
    "Could not reach the media library. Nothing was removed.",
    // Longer than the rest: this one deletes the row and then asks Cloudinary
    // to destroy the file, so it is two round trips wearing one request.
    20_000,
  );
}

export async function setMediaAlt(
  id: string,
  alt: string,
  expectedUpdatedAt: string,
): Promise<MediaAsset> {
  const response = await libraryRequest(
    `/api/newsroom/media/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alt, expectedUpdatedAt }),
    },
    "That description could not be saved.",
    "Could not reach the media library. The description was not saved.",
  );

  try {
    return (await response.json()) as MediaAsset;
  } catch {
    throw new Error("The library's answer could not be read. Reload before editing further.");
  }
}
