"use client";

/**
 * The media library.
 *
 * ── Why IndexedDB and not localStorage ───────────────────────────────────
 * Every other local store in this admin is `localStorage`, which is right for
 * a draft: a few kilobytes of text, read and written synchronously. It is the
 * wrong tool for a photograph. `localStorage` holds strings, so a file has to
 * be base64'd — a 33% size penalty on top of a quota that is around 5MB for
 * the whole origin. One picture from a phone camera would fill it and take
 * the drafts down with it.
 *
 * IndexedDB stores `Blob` directly, has a quota measured in hundreds of
 * megabytes, and is asynchronous, so decoding a large file does not freeze
 * the page. It is the only sensible answer here.
 *
 * ── Two kinds of item, deliberately ──────────────────────────────────────
 * A linked item holds a URL and nothing else: it is already hosted, and
 * copying it into the browser would only create a second version to drift.
 * An uploaded item holds the bytes, because until there is an API there is
 * nowhere else for them to be. `srcFor` resolves either to something an
 * `<img>` or `<video>` can use, and upload URLs are object URLs — alive for
 * this document only, which is exactly why they are minted on read rather
 * than stored.
 */

const DB_NAME = "vv-media";
const STORE = "items";
const VERSION = 1;

export type MediaKind = "image" | "video";
export type MediaSource = "upload" | "link";

export interface MediaItem {
  id: string;
  kind: MediaKind;
  source: MediaSource;
  /** Filename, or the last path segment of a link. Shown as the item's name. */
  name: string;
  alt: string;
  createdAt: string;
  /** Present on linked items. */
  url?: string;
  /** Present on uploaded items. */
  blob?: Blob;
  /** Bytes, for uploads. Shown so a full library is diagnosable. */
  size?: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      }),
  );
}

const newId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export async function listMedia(): Promise<MediaItem[]> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return [];
  try {
    const all = await tx<MediaItem[]>("readonly", (store) => store.getAll());
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

/** What a file's MIME type says it is. Anything else is refused by the caller. */
export function kindOf(type: string): MediaKind | null {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  return null;
}

export async function addUpload(file: File): Promise<MediaItem> {
  const kind = kindOf(file.type);
  if (!kind) throw new Error(`${file.name} is not an image or a video.`);

  const item: MediaItem = {
    id: newId(),
    kind,
    source: "upload",
    name: file.name,
    alt: "",
    createdAt: new Date().toISOString(),
    // Stored as a Blob, not a data URL. See the note at the top.
    blob: file,
    size: file.size,
  };
  await tx("readwrite", (store) => store.put(item));
  return item;
}

/**
 * Adds a link.
 *
 * Only `http(s)`. `javascript:` and `data:` are the two that turn an image
 * field into an execution sink, and there is no reason a media library needs
 * either — a pasted `data:` URL is a file, and the upload path handles files.
 */
export async function addLink(rawUrl: string, kind: MediaKind): Promise<MediaItem> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("That is not a full web address.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Links must start with http:// or https://");
  }

  const last = parsed.pathname.split("/").filter(Boolean).pop();
  const item: MediaItem = {
    id: newId(),
    kind,
    source: "link",
    name: last ? decodeURIComponent(last) : parsed.hostname,
    alt: "",
    createdAt: new Date().toISOString(),
    url: parsed.toString(),
  };
  await tx("readwrite", (store) => store.put(item));
  return item;
}

export async function setAlt(id: string, alt: string): Promise<void> {
  const existing = await tx<MediaItem | undefined>("readonly", (store) => store.get(id));
  if (!existing) return;
  await tx("readwrite", (store) => store.put({ ...existing, alt }));
}

export async function removeMedia(id: string): Promise<void> {
  await tx("readwrite", (store) => store.delete(id));
}

/**
 * A URL this item can be rendered from.
 *
 * Object URLs are minted per call and must be revoked by the caller when the
 * element goes away — an un-revoked object URL pins its blob in memory for the
 * life of the document, which for a page showing forty photographs is a leak
 * you can watch happen.
 */
export function srcFor(item: MediaItem): string | null {
  if (item.source === "link") return item.url ?? null;
  if (item.blob) return URL.createObjectURL(item.blob);
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
