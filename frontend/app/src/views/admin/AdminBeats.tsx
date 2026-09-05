"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Tags, Trash2 } from "lucide-react";
import { useTaxonomy } from "@/context/TaxonomyProvider";
import { useAllStories } from "@/hooks/useStories";
import { storiesByGenre } from "@/lib/taxonomy";
import { VIDEOS, videoBeat } from "@/data/videos";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/toast";
import { addBeat, removeBeat, slugify } from "@/lib/beats";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/Button";

/**
 * Beats — the taxonomy every story is filed against.
 *
 * ── What changed ─────────────────────────────────────────────────────────
 * This screen used to show two groups apart, and was right to: the published
 * beats had public pages and a beat opened here lived in `localStorage`, so
 * merging them "would be a tidier screen that tells the reader something
 * untrue". Beats are rows now. A beat opened here has a page, appears in the
 * footer and the sitemap, and is what `generateStaticParams` builds — so the
 * split has stopped being true and the screen shows one list.
 *
 * ── Deleting is refused, not warned about ────────────────────────────────
 * The old version removed a beat and mentioned in the toast how many stories
 * were still filed under it, because `localStorage` could not enforce anything.
 * The API can: `genreSlug` is a foreign key, and a beat with work under it or
 * subjects beneath it comes back as a 409 naming how many of each. Nothing is
 * removed, and the message says what to move first.
 */
export default function AdminBeats() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { genres, inGenre, parentBeat } = useTaxonomy();
  // The taxonomy arrives as a server prop, so refreshing it means re-running
  // the route that fetched it. That also updates every other beat picker on
  // the site, which is the point: a beat opened here is immediately filable.
  const router = useRouter();
  const refresh = () => router.refresh();
  // Drafts included: a beat with only unpublished work filed under it still
  // has work filed under it, and removing it would still strand that work.
  const { data: stories } = useAllStories();
  const filedUnder = (slug: string) => storiesByGenre(genres, stories ?? [], slug).length;

  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    const result = await addBeat(name, description);
    setSaving(false);

    if (!result.ok) {
      // The fields keep what was typed. A duplicate slug is the common failure
      // and the fix is usually a different name, not a re-typed one.
      setError(result.message);
      return;
    }

    setName("");
    setDescription("");
    setError(null);
    // `refresh` rather than a local push: the taxonomy is shared with every
    // beat picker on the site, and a list updated here alone would leave the
    // story workspace unable to file anything under the beat just opened.
    refresh();
    notify.success(`Beat “${result.value.name}” opened`, "Stories can be filed under it now.");
  };

  /**
   * Remove, with no undo offered.
   *
   * `notify.undo` was right when this wrote to `localStorage` and the delete
   * always succeeded. Against the API a delete either succeeds — in which case
   * nothing was filed under it and there is very little to undo — or is refused
   * outright, and offering to undo a thing that did not happen is the kind of
   * lie the rest of this workspace has been busy removing.
   */
  const drop = async (beat: { slug: string; name: string }) => {
    const result = await removeBeat(beat.slug);
    if (!result.ok) {
      notify.error(
        result.reason === "blocked" ? "That beat is still in use" : "The beat was not removed",
        result.message,
      );
      return;
    }
    refresh();
    notify.success(`“${beat.name}” removed`);
  };

  const preview = slugify(name);

  return (
    <div className="mx-auto max-w-[1100px]">
      <Reveal variant="fade-up">
        <p className="rule-label">Content</p>
        <h1 className="font-display desk-title mt-2 font-semibold">Beats</h1>
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
              {genres.map((beat) => {
                const reports = VIDEOS.filter((v) => inGenre(videoBeat(v), beat.slug)).length;
                const written = filedUnder(beat.slug);
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
                    {/* Offered on every beat, including the ones with work
                        filed under them. The API refuses those with a sentence
                        naming what is in the way, which is more use than a
                        control that is simply absent and leaves somebody
                        wondering whether beats can be removed at all. */}
                    <button
                      type="button"
                      onClick={() => void drop(beat)}
                      aria-label={`Remove ${beat.name}`}
                      className="focus-ring tap-square flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all duration-normal hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Reveal>

        </div>

        <Reveal
          variant="fade-up"
          delay={120}
          className="surface honeycomb honeycomb-strong h-fit overflow-hidden p-5 sm:p-6 lg:sticky lg:top-24"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center text-primary">
            <Tags className="h-5 w-5" aria-hidden />
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
