"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Film, ImagePlus, Link2, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { stagger, transitions } from "@/lib/motion";
import { notify } from "@/lib/toast";
import {
  addLink,
  addUpload,
  formatBytes,
  listMedia,
  removeMedia,
  srcFor,
  type MediaItem,
  type MediaKind,
} from "@/lib/media";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";

/**
 * Pictures and clips, from a device or from a link.
 *
 * The file input carries `accept="image/*,video/*"` and no `capture`
 * attribute. That combination is deliberate: on a phone it opens the system
 * sheet, which offers the camera *and* the library and the files app, so one
 * control covers "take one now" and "use the one I shot yesterday". Forcing
 * `capture` would take the second away, and on a laptop it does nothing at
 * all.
 *
 * Drag-and-drop is wired to the same handler as the picker rather than being
 * a second path with its own bugs.
 */
export default function AdminMedia() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkKind, setLinkKind] = useState<MediaKind>("image");
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const reduced = useReducedMotion();

  const refresh = useCallback(async () => {
    setItems(await listMedia());
    setReady(true);
  }, []);

  // IndexedDB is async, so unlike the other local stores this one genuinely is
  // an external system being subscribed to — an effect is the right shape here
  // and the setState lands in a callback, not in the effect body.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const take = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);

    let added = 0;
    const rejected: string[] = [];
    for (const file of Array.from(files)) {
      try {
        await addUpload(file);
        added += 1;
      } catch (cause) {
        rejected.push(cause instanceof Error ? cause.message : file.name);
      }
    }

    await refresh();
    setBusy(false);

    if (added > 0) notify.success(`${added} ${added === 1 ? "file" : "files"} added`);
    // Reported, not swallowed. A picker that accepts five files and silently
    // keeps three is worse than one that refuses all five.
    if (rejected.length > 0) setError(rejected.join(" "));
  };

  const submitLink = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const item = await addLink(linkUrl, linkKind);
      await refresh();
      setLinkUrl("");
      setError(null);
      notify.success("Link added", item.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That link could not be added.");
    } finally {
      setBusy(false);
    }
  };

  const drop = async (item: MediaItem) => {
    await removeMedia(item.id);
    setItems((list) => list.filter((i) => i.id !== item.id));
    notify.success(`“${item.name}” removed`);
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <Reveal variant="fade-up">
        <p className="rule-label">Content</p>
        <h1 className="font-display display-2 mt-2 font-semibold">Media</h1>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          Pictures and clips for your stories. Uploads are held in this browser and never
          leave it; links point at wherever the file already lives. Both can be dropped
          into an article.
        </p>
      </Reveal>

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Library ──────────────────────────────────────────── */}
        <div className="lg:order-1">
          {!ready ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="surface aspect-[4/3] animate-pulse bg-muted" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<ImagePlus className="h-5 w-5" aria-hidden />}
              title="Nothing here yet"
              description="Add a picture or a clip from this device, or paste a link to one that is already online."
              action={
                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                  Choose a file
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence initial={false}>
                {items.map((item, i) => (
                  <motion.li
                    key={item.id}
                    layout={!reduced}
                    initial={reduced ? false : { opacity: 0, y: 10 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      transition: {
                        ...transitions.normal,
                        delay: Math.min(i, 8) * stagger.tight,
                      },
                    }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                    transition={transitions.normal}
                    className="surface group flex flex-col overflow-hidden"
                  >
                    <MediaThumb item={item} />
                    <div className="flex items-center gap-2 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{item.name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {item.source === "link" ? "Linked" : "On this device"}
                          {item.size ? ` · ${formatBytes(item.size)}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => drop(item)}
                        aria-label={`Remove ${item.name}`}
                        className="focus-ring tap-square flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-normal hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {/* ── Add ──────────────────────────────────────────────── */}
        <Reveal
          variant="fade-up"
          delay={80}
          className="h-fit space-y-4 lg:sticky lg:top-24 lg:order-2"
        >
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void take(e.dataTransfer.files);
            }}
            className={cn(
              "surface honeycomb honeycomb-strong overflow-hidden p-5 transition-colors duration-normal sm:p-6",
              dragging && "border-accent bg-accent/[0.06]",
            )}
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
              <Upload className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <h2 className="font-display mt-4 text-lg font-semibold tracking-tight">
              From this device
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              On a phone this opens the camera, your photos and your files together. Drop
              files here too.
            </p>

            {/* No `capture`: it would replace the system sheet with the camera
                alone, taking away the library and the files app, and it does
                nothing on a laptop. */}
            <input
              ref={fileInput}
              type="file"
              accept="image/*,video/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                void take(e.target.files);
                // Cleared so choosing the same file twice fires `change` again.
                e.target.value = "";
              }}
            />
            <Button
              className="mt-5 w-full"
              onClick={() => fileInput.current?.click()}
              loading={busy}
              loadingText="Adding"
            >
              <ImagePlus className="icon-pop h-4 w-4" aria-hidden />
              Choose a photo or clip
            </Button>
          </div>

          <form onSubmit={submitLink} className="surface p-5 sm:p-6">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
              <Link2 className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <h2 className="font-display mt-4 text-lg font-semibold tracking-tight">
              From a link
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              For a file that is already online. Nothing is copied — the article points at
              the original.
            </p>

            <label htmlFor="media-url" className="rule-label mt-5 block">
              Address
            </label>
            <input
              id="media-url"
              type="url"
              value={linkUrl}
              onChange={(e) => {
                setLinkUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://…"
              className="focus-ring mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-accent"
            />

            <div
              role="group"
              aria-label="Kind"
              className="surface-compact mt-3 flex items-center gap-1 p-1"
            >
              {(["image", "video"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setLinkKind(kind)}
                  aria-pressed={linkKind === kind}
                  className={cn(
                    "focus-ring relative inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-semibold capitalize transition-colors duration-normal",
                    linkKind === kind
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-primary",
                  )}
                >
                  {linkKind === kind && (
                    <motion.span
                      layoutId={reduced ? undefined : "media-kind-pill"}
                      className="absolute inset-0 rounded-md bg-primary"
                      transition={transitions.normal}
                    />
                  )}
                  <span className="relative">{kind}</span>
                </button>
              ))}
            </div>

            <Button
              type="submit"
              variant="outline"
              className="mt-4 w-full"
              disabled={!linkUrl.trim() || busy}
            >
              Add the link
            </Button>
          </form>

          {error && (
            <p role="alert" className="text-sm leading-snug text-destructive">
              {error}
            </p>
          )}
        </Reveal>
      </div>
    </div>
  );
}

/**
 * One thumbnail.
 *
 * The object URL is minted here and revoked on unmount. An un-revoked object
 * URL pins its blob for the life of the document, which on a page of forty
 * photographs is a leak you can watch in the memory graph.
 */
function MediaThumb({ item }: { item: MediaItem }) {
  // Derived, not stored. This component only ever renders after `listMedia`
  // has resolved, so it is always on the client and `createObjectURL` exists.
  const src = useMemo(() => srcFor(item), [item]);

  useEffect(() => {
    if (!src || item.source !== "upload") return;
    return () => URL.revokeObjectURL(src);
  }, [src, item.source]);

  if (!src) {
    return <div className="aspect-[4/3] w-full bg-muted" />;
  }

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
      {item.kind === "video" ? (
        <>
          {/* `preload="metadata"` so the poster frame appears without pulling
              the whole clip down, and no autoplay — these have sound. */}
          <video
            src={src}
            preload="metadata"
            muted
            playsInline
            controls
            className="h-full w-full object-cover"
          />
          <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            <Film className="h-3 w-3" aria-hidden />
            Video
          </span>
        </>
      ) : (
        // A plain <img>: these are blob and arbitrary remote URLs, which the
        // Next optimiser has no route for and no `remotePatterns` entry for.
        <img src={src} alt={item.alt} loading="lazy" className="h-full w-full object-cover" />
      )}
    </div>
  );
}
