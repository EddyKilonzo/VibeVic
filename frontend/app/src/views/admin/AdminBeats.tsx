"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Plus, Tags, Trash2 } from "lucide-react";
import { GENRES, inGenre, parentBeat, storiesByGenre } from "@/data/content";
import { VIDEOS, videoBeat } from "@/data/videos";
import { cn } from "@/lib/utils";
import { stagger, transitions } from "@/lib/motion";
import { notify } from "@/lib/toast";
import { addBeat, listCustomBeats, removeBeat, slugify, type CustomBeat } from "@/lib/beats";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/Button";

/**
 * Beats: the seven the site publishes, and any opened here.
 *
 * The two groups are shown apart rather than in one list, because they are not
 * the same kind of thing. The published seven have public pages, appear in the
 * footer and the sitemap, and are what `generateStaticParams` builds. A beat
 * opened here exists in this browser: a draft can be filed under it today, and
 * it gets a public page when the API lands and a build follows. Merging them
 * into one table would be a tidier screen that tells the reader something
 * untrue.
 */
export default function AdminBeats() {
  const [custom, setCustom] = useState<CustomBeat[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reduced = useReducedMotion();

  // Ref callback, not an effect: the route is prerendered, so reading storage
  // during the first client pass disagrees with the HTML being hydrated.
  const load = useCallback((node: HTMLDivElement | null) => {
    if (node) setCustom(listCustomBeats());
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = addBeat(name, description);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setCustom(listCustomBeats());
    setName("");
    setDescription("");
    setError(null);
    notify.success(`Beat “${result.beat.name}” opened`, "Stories can be filed under it now.");
  };

  const drop = (beat: CustomBeat) => {
    const filed = storiesByGenre(beat.slug).length;
    removeBeat(beat.slug);
    setCustom((list) => list.filter((b) => b.slug !== beat.slug));
    notify.undo(
      filed > 0
        ? `“${beat.name}” removed — ${filed} ${filed === 1 ? "story is" : "stories are"} still filed under it`
        : `“${beat.name}” removed`,
      () => {
        addBeat(beat.name, beat.description);
        setCustom(listCustomBeats());
      },
    );
  };

  const preview = slugify(name);

  return (
    <div ref={load} className="mx-auto max-w-[1100px]">
      <Reveal variant="fade-up">
        <p className="rule-label">Content</p>
        <h1 className="font-display display-2 mt-2 font-semibold">Beats</h1>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          The subjects the work is filed under. The published beats are compiled into the
          site — pages, footer, sitemap. A beat you open here lives in this browser and can
          hold drafts straight away; it gets its public page once the API lands.
        </p>
      </Reveal>

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Reveal variant="fade-up" delay={60} className="surface p-5 sm:p-6">
            <p className="rule-label">Published beats</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Live on the site. Editing these means editing the source and rebuilding.
            </p>

            <ul className="mt-5 divide-y divide-border">
              {GENRES.map((beat) => {
                const reports = VIDEOS.filter((v) => inGenre(videoBeat(v), beat.slug)).length;
                const written = storiesByGenre(beat.slug).length;
                const child = !!parentBeat(beat.slug);
                return (
                  <li
                    key={beat.slug}
                    className={cn(
                      "flex items-baseline gap-4 py-3 first:pt-0",
                      // Indented rather than grouped into separate lists: the
                      // whole point of this panel is that it is the filing
                      // system, in filing order.
                      child && "pl-4",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm",
                          child ? "font-medium text-muted-foreground" : "font-semibold",
                        )}
                      >
                        {beat.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        /{beat.slug}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {reports > 0 && `${reports} report${reports === 1 ? "" : "s"}`}
                      {reports > 0 && written > 0 && " · "}
                      {written > 0 && `${written} written`}
                      {reports === 0 && written === 0 && "nothing filed"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Reveal>

          {custom.length > 0 && (
            <Reveal variant="fade-up" className="surface p-5 sm:p-6">
              <p className="rule-label">Opened here</p>
              <p className="mt-1 text-sm text-muted-foreground">
                On this device only, until the API lands.
              </p>

              <ul className="mt-5 divide-y divide-border">
                <AnimatePresence initial={false}>
                  {custom.map((beat, i) => (
                    <motion.li
                      key={beat.slug}
                      layout={!reduced}
                      initial={reduced ? false : { opacity: 0, y: 8 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        transition: {
                          ...transitions.normal,
                          delay: Math.min(i, 8) * stagger.tight,
                        },
                      }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0, x: -12, height: 0 }}
                      transition={transitions.normal}
                      className="group flex items-center gap-4 py-3 first:pt-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{beat.name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          /{beat.slug}
                          {beat.description && ` · ${beat.description}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => drop(beat)}
                        aria-label={`Remove ${beat.name}`}
                        className="focus-ring tap-square flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-normal hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </Reveal>
          )}
        </div>

        <Reveal
          variant="fade-up"
          delay={120}
          className="surface honeycomb honeycomb-strong h-fit overflow-hidden p-5 sm:p-6 lg:sticky lg:top-24"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
            <Tags className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <h2 className="font-display mt-4 text-lg font-semibold tracking-tight">
            Open a new beat
          </h2>

          <form onSubmit={submit} className="mt-5">
            <label htmlFor="beat-name" className="rule-label">
              Name
            </label>
            <input
              id="beat-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Housing, say, or Elections"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "beat-error" : preview ? "beat-slug" : undefined}
              className="focus-ring mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-accent"
            />

            {/* The slug, shown as it forms. It is the value written onto every
                story filed here and it appears in the URL, so seeing it before
                committing beats discovering it afterwards. */}
            {preview && !error && (
              <p id="beat-slug" className="mt-2 text-xs text-muted-foreground">
                Filed as <code className="text-primary">/{preview}</code>
              </p>
            )}

            <label htmlFor="beat-desc" className="rule-label mt-5 block">
              What it covers
            </label>
            <textarea
              id="beat-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="One line. It becomes the beat's standfirst on the site."
              className="focus-ring mt-2 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            />

            {error && (
              <p
                id="beat-error"
                role="alert"
                className="mt-3 text-sm leading-snug text-destructive"
              >
                {error}
              </p>
            )}

            <Button type="submit" className={cn("mt-5 w-full")} disabled={!name.trim()}>
              <Plus className="icon-pop h-4 w-4" aria-hidden />
              Open the beat
            </Button>
          </form>

          <p className="mt-6 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
            A name that matches a published beat is refused rather than merged — two beats
            sharing a slug would make every story filed under it ambiguous, including the
            ones already live.
          </p>
        </Reveal>
      </div>
    </div>
  );
}
