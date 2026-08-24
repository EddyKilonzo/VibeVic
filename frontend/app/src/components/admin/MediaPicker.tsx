"use client";

import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Loader2, RefreshCw, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { cloudinaryUrl, isCloudinary } from "@/lib/cloudinary";
import { kindOf } from "@/lib/media";
import {
  listMediaAssets,
  uploadMedia,
  UploadError,
  type MediaAsset,
} from "@/lib/media-upload";

/**
 * Choosing a picture: from the library, or by uploading one.
 *
 * One component for both places that need it — the cover on a story and an
 * image block inside it — because they are the same decision and having two
 * would mean two upload paths, two error states, and one of them getting fixed
 * without the other.
 *
 * ── What it hands back ───────────────────────────────────────────────────
 * The delivery URL, not the library id. An id would need a lookup to resolve,
 * the library is behind the newsroom gate, and a reader is not in the
 * newsroom — so a published article referencing an id would render a blank
 * frame for everyone. A URL is the thing that works in both places, which is
 * why it is what gets stored.
 *
 * This replaces a picker that wrote to IndexedDB. That one stored a blob URL,
 * alive only for the document that created it: a picture inserted into an
 * article was visible to the person who inserted it and to nobody else, ever.
 */
export function MediaPicker({
  onPick,
  onCancel,
  /** Narrows the grid; uploads are still restricted to this kind. */
  kind = "image",
}: {
  onPick: (asset: MediaAsset) => void;
  onCancel?: () => void;
  kind?: "image" | "video";
}) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const wanted = kind === "video" ? "VIDEO" : "IMAGE";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listMediaAssets();
      setAssets(all.filter((asset) => asset.kind === wanted));
      setProblem(null);
    } catch (cause) {
      // An empty grid and an unreachable library look identical otherwise, and
      // the first would have the writer believe they have no pictures.
      setProblem(cause instanceof Error ? cause.message : "The library could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [wanted]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const take = async (file: File | undefined) => {
    if (!file) return;

    const fileKind = kindOf(file.type);
    if (fileKind !== kind) {
      setProblem(`That is not ${kind === "image" ? "an image" : "a video"}.`);
      return;
    }

    setBusy(true);
    setProblem(null);
    setProgress(0);
    try {
      const asset = await uploadMedia(file, fileKind, setProgress);
      // Straight through: uploading is choosing. Making the writer pick it out
      // of the grid afterwards is a second step for a decision already made.
      onPick(asset);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "That file could not be added.";
      // A `record` failure means the file did reach Cloudinary — worth saying,
      // because the fix is to retry rather than to re-select the file.
      setProblem(
        cause instanceof UploadError && cause.step === "record"
          ? `${message} Refresh the library to find it.`
          : message,
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="surface-compact space-y-3 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="rule-label">From the library</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="Refresh the library"
            className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-primary"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close the picker"
              className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-primary"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : assets.length > 0 ? (
        <ul className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {assets.map((asset) => (
            <li key={asset.id}>
              <button
                type="button"
                onClick={() => onPick(asset)}
                title={asset.name}
                className="focus-ring group relative block aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-secondary transition-colors hover:border-accent"
              >
                {/* 200px: this is a picker, not a gallery. Asking Cloudinary
                    for a thumbnail keeps a library of a hundred pictures from
                    pulling a hundred originals. */}
                <img
                  src={isCloudinary(asset.url) ? cloudinaryUrl(asset.url, { width: 200 }) : asset.url}
                  alt={asset.alt || asset.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-normal group-hover:scale-105"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Nothing in the library yet. Upload the first one below.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <label
          className={cn(
            "focus-within:ring-focus inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-xs font-semibold transition-colors hover:border-accent hover:text-accent",
            busy && "pointer-events-none opacity-50",
          )}
        >
          <input
            type="file"
            accept={kind === "video" ? "video/*" : "image/*"}
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              void take(event.target.files?.[0]);
              // Cleared so picking the same file twice still fires a change.
              event.target.value = "";
            }}
          />
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="h-4 w-4" aria-hidden />
          )}
          {busy ? "Uploading…" : "Upload a new one"}
        </label>

        {progress !== null && (
          <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {Math.round(progress * 100)}%
          </span>
        )}

        {!busy && assets.length === 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ImagePlus className="h-3.5 w-3.5" aria-hidden />
            Anything you add here appears in Media too.
          </span>
        )}
      </div>

      {problem && (
        <p role="alert" className="text-xs leading-relaxed text-destructive">
          {problem}
        </p>
      )}
    </div>
  );
}
