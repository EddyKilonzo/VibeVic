"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Bookmark, BookOpen, Headphones, ShieldCheck, Trash2, Users } from "lucide-react";
import { usePublishedStories } from "@/hooks/useStories";
import { useBookmarks } from "@/context/BookmarksProvider";
import { useReadState } from "@/hooks/useReadingPosition";
import { summariseAll, type AudioSummary } from "@/lib/voice/analytics";
import { formatPercent, formatRelative } from "@/lib/format";
import { Reveal } from "@/components/motion";
import { ReadProgress } from "@/components/story/ReadProgress";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { newsroomPath } from "@/lib/newsroom-path";

/**
 * Readers.
 *
 * ── What this screen used to say, and what changed ───────────────────────
 * It opened by admitting there was no audience data: "no accounts, no server,
 * no third-party analytics script anywhere in the app". Two of those three are
 * still true and are meant to stay true. The middle one stopped being true, and
 * the site now counts reading itself — first-party, anonymously, with no cookie
 * and no profile. `lib/reader-events` sets out exactly what leaves a reader's
 * browser and why it cannot identify them.
 *
 * The tempting version of this screen was always the one that invented a
 * plausible audience out of the single browser it could see: "23 readers",
 * drawn from twenty-three page views on the journalist's own laptop. That
 * number would be believed, repeated, and wrong. The figures are real now, so
 * the panels can stop hedging — but the two kinds are still kept apart, because
 * "how many people finished this" and "how far this browser got" are different
 * facts and only one of them is about readers.
 *
 * ── The statement panel is still the point ───────────────────────────────
 * It sets out in one place what the site does and does not collect about the
 * people who read it, which is the thing a journalist gets asked about their
 * own site. It has been rewritten rather than removed: the honest answer
 * changed, and an out-of-date privacy statement is worse than none.
 */
export default function AdminReaders() {
  const { data } = usePublishedStories();
  const stories = data ?? [];
  const storyBySlug = (slug: string) => stories.find((story) => story.slug === slug);
  const { slugs, remove } = useBookmarks();

  /**
   * Everything on this screen comes out of browser storage, and the route is
   * prerendered — so nothing storage-backed is rendered until the page is up.
   *
   * That includes the bookmarks, which arrive through context rather than
   * through a read of my own: the provider fills them in from `localStorage`
   * during its first render, so a panel that counted them immediately would
   * be describing a list the server render knew nothing about. `ready` is the
   * gate, set by the same ref callback that reads the playback.
   */
  const [ready, setReady] = useState(false);
  const [audio, setAudio] = useState<AudioSummary[] | null>(null);
  const load = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    setAudio(summariseAll());
    setReady(true);
  }, []);

  const saved = ready ? slugs : [];

  const plays = audio?.reduce((n, s) => n + s.plays, 0) ?? 0;

  return (
    <div ref={load} className="mx-auto max-w-[1100px]">
      <Reveal variant="fade-up">
        <p className="rule-label">Newsroom</p>
        <h1 className="font-display display-2 mt-2 font-semibold">Readers</h1>
        <p className="mt-3 max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
          The site counts reading itself — no accounts, no cookies, no third-party script,
          and nothing that can tell two visits apart. What the figures cover is below, and
          so is what this browser knows about its own reading, kept separate.
        </p>
      </Reveal>

      {/* The statement first, because every panel under it has to be read in
          its light. A caveat at the bottom of a page of figures is a caveat
          nobody reads. */}
      <Reveal
        variant="fade-up"
        delay={40}
        // Frosted rather than solid, and `glass-strong` on this one because
        // it is the panel the rest of the page is read in the light of.
        // `.glass` sets its own border, ground and shadow but no radius —
        // that is `.surface`'s job and this is not one — so the corner is
        // stated here. The lattice on the workspace ground shows through the
        // blur, which is the whole point of frosting it.
        className="glass-strong honeycomb honeycomb-strong mt-8 overflow-hidden rounded-xl p-5 sm:p-6"
      >
        <span className="inline-flex h-9 w-9 items-center justify-center text-primary">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="font-display mt-4 text-lg font-semibold tracking-tight">
          What the site collects about readers
        </h2>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <Fact
            term="Counted, not identified"
            detail="Three things per story: opened, finished, listened to. Each carries a random string this tab invented, which is thrown away when the tab closes and is never read back. No cookie, no address, no profile, and no way to connect two visits."
          />
          <Fact
            term="No third-party anything"
            detail="No analytics script is loaded on any page. There is no tag manager, no pixel and no third-party embed on the reading surface except YouTube's player on video pages. The counting is the site's own."
          />
          <Fact
            term="Saved stories, locally"
            detail="Bookmarks live in this browser's own storage and are never sent anywhere. That is why they are not tied to an account — reading and saving are not gated."
          />
          <Fact
            term="Reading position, locally"
            detail="How far into a piece you got, written on the way out of the page so it can be offered back. One fraction per story, in this browser."
          />
          <Fact
            term="One cookie, for the workspace"
            detail="The newsroom passphrase cookie, which readers never receive. It is httpOnly and holds a hash, not the passphrase."
          />
        </dl>

        <p className="mt-5 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
          A reader who blocks the request, reads offline or has storage disabled is simply
          not counted. Nothing is estimated to fill the gap, so these figures are a floor
          rather than an audience — which is the honest thing for them to be.
        </p>
      </Reveal>

      {/* ── Saved on this device ───────────────────────────────── */}
      <Reveal variant="fade-up" className="mt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="rule-label">Saved on this device</p>
            <h2 className="font-display mt-1 text-lg font-semibold tracking-tight">
              {!ready
                ? "Reading this browser"
                : saved.length === 0
                  ? "Nothing saved"
                  : `${saved.length} saved ${saved.length === 1 ? "story" : "stories"}`}
            </h2>
          </div>
          {plays > 0 && (
            <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Headphones className="h-4 w-4" aria-hidden />
              {plays} {plays === 1 ? "play" : "plays"} recorded ·{" "}
              <Link href={newsroomPath("/analytics")} className="focus-ring underline-grow font-semibold text-primary">
                see the detail
              </Link>
            </p>
          )}
        </div>

        <div className="glass mt-4 overflow-hidden rounded-xl">
          {saved.length === 0 ? (
            <EmptyState
              icon={<Bookmark className="h-5 w-5" aria-hidden />}
              title="No saved stories in this browser"
              description="Saving a piece on the public site puts it here. It is the reader's own list, kept on their device — this one shows yours."
              className="border-0"
              action={
                <Button as={Link} href="/stories" variant="outline" size="sm">
                  Open the archive
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {saved.map((slug) => {
                const story = storyBySlug(slug);
                return (
                  <li
                    key={slug}
                    className="group flex items-center gap-4 p-4 transition-colors duration-normal hover:bg-secondary/50"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/stories/${slug}`}
                        className="focus-ring underline-grow block truncate text-sm font-semibold"
                      >
                        {story?.title ?? slug}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {story
                          ? `Published ${formatRelative(story.publishedAt)}`
                          : "This piece is no longer in the archive"}
                      </p>
                    </div>

                    <ReadProgress slug={slug} className="hidden shrink-0 sm:inline-flex" />

                    <button
                      type="button"
                      onClick={() => remove(slug)}
                      aria-label={`Remove ${story?.title ?? slug} from saved`}
                      className="focus-ring tap-square flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all duration-normal hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Reveal>

      {/* ── The archive, as this browser has read it ───────────── */}
      <Reveal variant="fade-up" className="glass mt-5 overflow-hidden rounded-xl">
        <div className="p-5 pb-4">
          <p className="rule-label">The archive on this device</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Every published piece, with how far this browser got. A piece with no mark has not
            been opened here — which is not the same as unread.
          </p>
        </div>

        <ul className="divide-y divide-border border-t border-border">
          {stories.map((story) => (
            <ArchiveRow key={story.id} slug={story.slug} title={story.title} saved={saved.includes(story.slug)} />
          ))}
        </ul>
      </Reveal>

      <Reveal
        variant="fade-up"
        delay={60}
        className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-dashed border-border p-4"
      >
        <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-muted-foreground">
          When the API lands, this screen is where consented audience data would go — and the
          panel at the top is the promise it would have to keep.
        </p>
      </Reveal>
    </div>
  );
}

/**
 * One archive row.
 *
 * `useReadState` is a hook, so the per-story read state has to be read in a
 * component of its own rather than in a loop — and it returns `null` through
 * the server render and the first client pass, which is exactly what keeps
 * this list free of hydration mismatches.
 */
function ArchiveRow({ slug, title, saved }: { slug: string; title: string; saved: boolean }) {
  const state = useReadState(slug);

  return (
    <li className="flex items-center gap-4 p-4 transition-colors duration-normal hover:bg-secondary/50">
      <BookOpen
        className={saved ? "h-4 w-4 shrink-0 text-primary" : "h-4 w-4 shrink-0 text-muted-foreground/50"}
        aria-hidden
      />
      <Link href={`/stories/${slug}`} className="focus-ring min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {state === null
            ? "Not opened in this browser"
            : state.finished
              ? "Finished here"
              : `${formatPercent(state.progress)} in`}
          {saved && " · saved"}
        </p>
      </Link>
      <ReadProgress slug={slug} className="shrink-0" />
    </li>
  );
}

function Fact({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="border-t border-border pt-4 sm:border-0 sm:pt-0">
      <dt className="text-sm font-semibold">{term}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{detail}</dd>
    </div>
  );
}
