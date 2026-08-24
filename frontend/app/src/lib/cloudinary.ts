/**
 * Cloudinary, on the delivery side.
 *
 * No credentials here and none needed: a delivery URL is built from the cloud
 * name, which is public by definition — it appears in every image address the
 * site serves. Signing and uploading live in `app/api/newsroom/media/`, behind
 * the newsroom gate, and the API secret never leaves the server.
 *
 * ── Why the transforms are in the URL rather than in next/image ──────────
 * `next/image` resizes and re-encodes through its own optimiser. Pointing it at
 * an image Cloudinary has already resized and re-encoded means paying for the
 * work twice and shipping the worse of the two results. So anything Cloudinary
 * serves is marked `unoptimized` at the call site and carries its own
 * `f_auto,q_auto` plus an explicit width — Cloudinary picks AVIF or WebP from
 * the request's Accept header, which is the same negotiation Next would do.
 *
 * Images from anywhere else — the WordPress archive, YouTube posters — keep
 * going through next/image exactly as before. `isCloudinary` is how a component
 * tells which is which.
 */

export const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

/** The folder every newsroom upload lands in, so the account stays legible. */
export const UPLOAD_FOLDER = "vibevic";

export function isCloudinaryConfigured(): boolean {
  return CLOUD_NAME.length > 0;
}

/** True for a URL this module is able to transform. */
export function isCloudinary(url: string): boolean {
  return url.startsWith("https://res.cloudinary.com/");
}

export interface DeliveryOptions {
  /** Target width in CSS pixels. Omitted means the original width. */
  width?: number;
  /** Crop to this height as well; without it the image keeps its ratio. */
  height?: number;
  /**
   * `fill` crops to the exact box, `fit` letterboxes inside it.
   *
   * Default is `fit`. A cover photograph cropped to a card's ratio can lose
   * the thing the picture is of, and on a journalist's site an automatic crop
   * that cuts a person out of a frame is a bad default to have chosen for them.
   */
  crop?: "fill" | "fit";
}

/**
 * A delivery URL for an already-uploaded asset.
 *
 * Takes either a public id (`vibevic/abc123`) or a full Cloudinary URL, because
 * both are stored around the app: the media library keeps public ids, while
 * `Story.cover` and image blocks hold whatever string was pasted or picked.
 */
export function cloudinaryUrl(idOrUrl: string, options: DeliveryOptions = {}): string {
  const publicId = isCloudinary(idOrUrl) ? publicIdFrom(idOrUrl) : idOrUrl;
  if (!publicId || !CLOUD_NAME) return idOrUrl;

  const transforms = ["f_auto", "q_auto"];
  if (options.width) transforms.push(`w_${Math.round(options.width)}`);
  if (options.height) transforms.push(`h_${Math.round(options.height)}`);
  if (options.width || options.height) transforms.push(`c_${options.crop ?? "fit"}`);

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms.join(",")}/${publicId}`;
}

/**
 * The public id inside a delivery URL.
 *
 * Cloudinary URLs are `/image/upload/[transforms]/[v123/]path/name.ext`. The
 * transform segment is optional and so is the version, which is why this walks
 * to `upload` and then skips segments by shape rather than counting positions.
 * The file extension is dropped — `f_auto` chooses the format, and leaving
 * `.jpg` on the end pins every browser to JPEG.
 */
export function publicIdFrom(url: string): string {
  const marker = "/image/upload/";
  const at = url.indexOf(marker);
  if (at === -1) return "";

  let rest = url.slice(at + marker.length);

  // A transform segment always contains a `_` in a comma-separated list and
  // never contains a `/`; a version segment is `v` followed by digits.
  const first = rest.split("/")[0] ?? "";
  if (/^[a-z]{1,3}_[^/]*$/.test(first)) rest = rest.slice(first.length + 1);

  const next = rest.split("/")[0] ?? "";
  if (/^v\d+$/.test(next)) rest = rest.slice(next.length + 1);

  return rest.replace(/\.[a-z0-9]+$/i, "");
}

/**
 * A `srcset` across the site's breakpoints.
 *
 * Cloudinary bills by transformation, so this deliberately reuses the same
 * width list everywhere rather than asking for a bespoke size per component —
 * a cached derivative is free, a novel one is not.
 */
export const WIDTHS = [320, 430, 640, 768, 1024, 1280, 1536] as const;

export function cloudinarySrcSet(idOrUrl: string, options: DeliveryOptions = {}): string {
  return WIDTHS.map(
    (width) => `${cloudinaryUrl(idOrUrl, { ...options, width })} ${width}w`,
  ).join(", ");
}
