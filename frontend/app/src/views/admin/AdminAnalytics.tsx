"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Eye, Headphones, Info, Youtube } from "lucide-react";
import { CHANNEL, VIDEOS, longFormVideos, shorts, topicName, totalViews, watchUrl } from "@/data/videos";
import { useAllStories } from "@/hooks/useStories";
import { useStoryFigures } from "@/hooks/useStoryFigures";
import { useTaxonomy } from "@/context/TaxonomyProvider";
import { summariseAll, type AudioSummary } from "@/lib/voice/analytics";
import { LOCALE, formatCompact, formatPercent, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/motion";
import { StatCard } from "@/components/admin/StatCard";
import { BeatShare } from "@/components/admin/BeatShare";
import { ViewsTrend } from "@/components/admin/ViewsTrend";
import { EmptyState } from "@/components/ui/States";

/**
 * Analytics.
 *
 * ── Three sources, and no fourth ─────────────────────────────────────────
 * Everything on this screen comes from one of three places, and each panel says
 * which: the YouTube figures captured into `data/videos` when that file was
 * written, playback this browser recorded itself, and — new — the newsroom's
 * own count of what readers did with the written archive.
 *
 * That third one used to be absent, and this comment used to explain why:
 * "there is no analytics endpoint". There is now, and it is first-party and
 * anonymous — see `lib/reader-events`. What has not changed is the rule: there
 * are still no referrers, no daily series and no "estimated reach", and a
 * number that cannot be pointed back at one of those three places does not
 * appear here.
 *
 * ── Why the dashboard is not enough on its own ───────────────────────────
 * The dashboard answers "how is the newsroom doing" in four figures and two
 * charts. This screen is the one you open when the answer was interesting:
 * every report with its share of the whole, long-form against Shorts, and the
 * listening data per piece rather than in summary. Same data, read closely.
 */

type Sort = "views" | "newest";

export default function AdminAnalytics() {
  const { data: allStories } = useAllStories();
  const {
    figures,
    loading: figuresLoading,
    error: figuresError,
  } = useStoryFigures();
  const { genreLabel } = useTaxonomy();
  const stories = allStories ?? [];
  const storyBySlug = (slug: string) => stories.find((story) => story.slug === slug);
  const [sort, setSort] = useState<Sort>("views");

  // Real recorded playback. Read once the screen is on the page rather than
  // during render: this route is prerendered, and reading storage on the first
  // client pass would disagree with the HTML being hydrated.
  const [audio, setAudio] = useState<AudioSummary[] | null>(null);
  const load = useCallback((node: HTMLDivElement | null) => {
    if (node) setAudio(summariseAll());
  }, []);

  const total = totalViews();

  const rows = useMemo(() => {
    const list = [...VIDEOS];
    list.sort((a, b) =>
      sort === "views" ? b.views - a.views : b.published.localeCompare(a.published),
    );
    return list;
  }, [sort]);

  /**
   * The mean, and only the mean.
   *
   * An average of eight real numbers is a real number. A median, a growth
   * rate or a projection would each need a series this product does not have,
   * so none of them are here.
   */
  const meanViews = VIDEOS.length ? Math.round(total / VIDEOS.length) : 0;

  const listened = audio?.reduce((n, s) => n + s.plays, 0) ?? 0;

  return (
    <div ref={load} className="mx-auto max-w-[1200px]">
      <Reveal variant="fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="rule-label">Newsroom</p>
            <h1 className="font-display display-2 mt-2 font-semibold">Analytics</h1>
            <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
              How the written archive travels, channel figures as captured from{" "}
              {CHANNEL.handle}, and playback recorded by this browser. Nothing here is
              modelled or estimated — where a number does not exist, the panel says so
              instead of drawing one.
            </p>
          </div>
          <a
            href={CHANNEL.url}
            target="_blank"
            rel="noreferrer noopener"
            className="focus-ring underline-grow inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            <Youtube className="icon-tilt h-4 w-4" aria-hidden />
            Open the channel
          </a>
        </div>
      </Reveal>

      {/* ── The written archive ─────────────────────────────────
          First, because it is the thing this newsroom actually publishes. The
          video figures below it are a capture from another platform; these are
          the site's own count, and they are the only numbers here that move on
          their own. */}
      <Reveal variant="fade-up" delay={40} className="surface mt-8 overflow-hidden">
        <div className="p-5 pb-4 sm:px-6">
          <p className="rule-label">The written archive</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Counted by the newsroom, once per reader per piece per day. Anonymous — see
            Readers for exactly what is collected.
          </p>
        </div>

        {/* Four states, and the difference between the last two is the whole
            point: a story nobody has opened is absent from this list, not
            present with a zero. A zero looks like a measurement. */}
        {figuresError ? (
          <EmptyState
            icon={<Eye className="h-5 w-5" aria-hidden />}
            title="The figures could not be loaded"
            description={figuresError}
            className="border-0"
          />
        ) : figuresLoading ? (
          <EmptyState
            icon={<Eye className="h-5 w-5" aria-hidden />}
            title="Reading the figures"
            description="Asking the newsroom what readers did."
            className="border-0"
          />
        ) : !figures || figures.length === 0 ? (
          <EmptyState
            icon={<Eye className="h-5 w-5" aria-hidden />}
            title="No reading recorded yet"
            description="Nothing has been opened since counting began. This stays empty rather than showing zeros — an absence and a measurement of nothing are different things."
            className="border-0"
          />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {figures.map((row) => {
              const story = storyBySlug(row.slug);
              return (
                <li
                  key={row.storyId}
                  className="flex items-center gap-4 p-4 transition-colors duration-normal hover:bg-secondary/50 sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{row.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {story ? genreLabel(story.genre) : "/" + row.slug}
                    </p>
                  </div>
                  <dl className="flex shrink-0 items-center gap-4 text-xs tabular-nums sm:gap-6">
                    <div className="text-right">
                      <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        Opened
                      </dt>
                      <dd className="font-semibold">{formatCompact(row.views)}</dd>
                    </div>
                    <div className="text-right">
                      <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        Finished
                      </dt>
                      <dd className="font-semibold">
                        {formatCompact(row.reads)}
                        {row.views > 0 && (
                          <span className="ml-1 font-normal text-muted-foreground">
                            {formatPercent(row.reads / row.views)}
                          </span>
                        )}
                      </dd>
                    </div>
                    <div className="hidden text-right sm:block">
                      <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        Listened
                      </dt>
                      <dd className="font-semibold">
                        {row.listens === 0 ? (
                          <span className="font-normal text-muted-foreground">—</span>
                        ) : (
                          <>
                            {formatCompact(row.listens)}
                            <span className="ml-1 font-normal text-muted-foreground">
                              {formatTime(row.avgListenSeconds)}
                            </span>
                          </>
                        )}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </Reveal>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total views"
          value={total}
          icon={Eye}
          caption={`Across ${VIDEOS.length} reports, at last capture`}
          accent
        />
        <StatCard
          label="Mean per report"
          value={meanViews}
          icon={BarChart3}
          caption="Total divided by reports — no weighting"
          delay={70}
        />
        <StatCard
          label="Long-form reports"
          value={longFormVideos().length}
          icon={Youtube}
          caption={`${shorts().length} Shorts alongside them`}
          delay={140}
        />
        <StatCard
          label="Plays on this device"
          value={listened}
          icon={Headphones}
          caption={
            audio === null
              ? "Reading recorded playback"
              : listened === 0
                ? "Nothing played aloud yet"
                : `Across ${audio.length} ${audio.length === 1 ? "piece" : "pieces"}`
          }
          delay={210}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <Reveal variant="fade-up" className="surface p-5 lg:col-span-7">
          <p className="rule-label">Views by publication month</p>
          <p className="mt-1 max-w-[54ch] text-sm text-muted-foreground">
            Reports grouped by the month they went out, accumulated. Today&rsquo;s view counts by
            vintage of work — not a traffic history, which would need the YouTube Analytics
            API.
          </p>
          <div className="mt-5">
            <ViewsTrend />
          </div>
        </Reveal>

        <Reveal
          variant="fade-up"
          delay={70}
          className="surface honeycomb honeycomb-strong overflow-hidden p-5 lg:col-span-5"
        >
          <p className="rule-label">Work by beat</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Reports and writing together. Length is the comparison; the label breaks each row
            down.
          </p>
          <div className="mt-6">
            <BeatShare />
          </div>
        </Reveal>
      </div>

      {/* ── Every report, with its share ───────────────────────── */}
      <Reveal variant="fade-up" className="surface mt-4 overflow-hidden lg:mt-5">
        <div className="flex flex-wrap items-end justify-between gap-3 p-5 pb-4">
          <div>
            <p className="rule-label">Every report</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Share is of {formatCompact(total)} views across the catalogue.
            </p>
          </div>

          <div role="group" aria-label="Sort" className="surface-compact flex items-center gap-1 p-1">
            {(
              [
                { id: "views", label: "Most viewed" },
                { id: "newest", label: "Newest" },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSort(option.id)}
                aria-pressed={sort === option.id}
                className={cn(
                  "focus-ring tap inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold transition-colors duration-normal",
                  sort === option.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-primary",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <ul className="divide-y divide-border border-t border-border">
          {rows.map((video) => {
            const share = total ? video.views / total : 0;
            return (
              <li
                key={video.id}
                className="flex items-center gap-4 p-4 transition-colors duration-normal hover:bg-secondary/50"
              >
                <div className="min-w-0 flex-1">
                  <a
                    href={watchUrl(video.id)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="focus-ring underline-grow block truncate text-sm font-semibold"
                  >
                    {video.title}
                  </a>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {topicName(video.topic)} · {video.format === "short" ? "Short" : "Report"} ·{" "}
                    {video.duration} · {video.published}
                  </p>

                  {/* One hue, length carrying magnitude — the same encoding
                      the beat panel uses, so the two read as one system. */}
                  <div
                    className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary"
                    role="img"
                    aria-label={`${formatPercent(share)} of all views`}
                  >
                    <span
                      className="block h-full rounded-full bg-[hsl(var(--chart-seq))]"
                      style={{ width: `${Math.max(2, share * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-display text-lg font-semibold tabular-nums text-primary">
                    {video.views.toLocaleString(LOCALE)}
                  </p>
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    {formatPercent(share, 1)} of views
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:mt-5 lg:grid-cols-12 lg:gap-5">
        {/* ── Listening ──────────────────────────────────────────── */}
        <Reveal variant="fade-up" className="surface p-5 lg:col-span-7">
          <p className="rule-label">Listening on this device</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Recorded as written pieces are played aloud with the voice player. It is this
            browser&rsquo;s own record, not an audience figure.
          </p>

          {audio === null ? (
            <p className="mt-6 text-sm text-muted-foreground">Reading recorded playback…</p>
          ) : audio.length === 0 ? (
            <EmptyState
              icon={<Headphones className="h-5 w-5" aria-hidden />}
              title="No playback recorded yet"
              description="Play a written piece with the voice player and its completion rate, average listen and preferred speed appear here."
              className="mt-6 border-0 bg-transparent px-0 py-10"
            />
          ) : (
            <ul className="mt-5 divide-y divide-border">
              {audio.map((summary) => {
                // Playback is recorded against the slug because that is the
                // stable key; the headline is what the piece is known by.
                const story = storyBySlug(summary.slug);
                return (
                  <li key={summary.slug} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-baseline gap-2">
                      <Link
                        href={`/stories/${summary.slug}`}
                        className="focus-ring underline-grow min-w-0 flex-1 truncate text-sm font-semibold"
                      >
                        {story?.title ?? summary.slug}
                      </Link>
                      {/* A recording whose piece is no longer in the archive.
                          Kept and labelled rather than dropped — the playback
                          happened, and hiding it would misstate the totals. */}
                      {!story && (
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          no longer published
                        </span>
                      )}
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                      <Metric label="Plays" value={String(summary.plays)} />
                      <Metric label="Finished" value={formatPercent(summary.completionRate)} />
                      <Metric label="Avg listen" value={formatTime(summary.avgSeconds)} />
                      <Metric
                        label="Speed"
                        value={summary.commonRate ? `${summary.commonRate}×` : "—"}
                      />
                    </dl>
                  </li>
                );
              })}
            </ul>
          )}
        </Reveal>

        {/* ── The honest limits ──────────────────────────────────── */}
        <Reveal
          variant="fade-up"
          delay={70}
          className="surface honeycomb honeycomb-strong h-fit overflow-hidden p-5 lg:col-span-5"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center text-primary">
            <Info className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="font-display mt-4 text-lg font-semibold tracking-tight">
            What this cannot tell you
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Worth knowing before a decision is made on these numbers.
          </p>

          <ul className="mt-5 space-y-4 text-sm">
            <Limit
              title="No traffic over time"
              detail="YouTube reports each video's views as they stand now, not how they accrued. A daily series needs the YouTube Analytics API."
            />
            <Limit
              title="No readers for the written archive"
              detail={`All ${stories.length} written pieces are served as static pages with no analytics endpoint behind them. Their reader counts are unknown, and unknown is what this screen reports.`}
            />
            <Limit
              title="Listening is one browser"
              detail="The playback panel is this device's own record. It is a genuine signal about how the voice player is used, and it is not an audience."
            />
            <Limit
              title="The channel figures are a snapshot"
              detail={`Captured when data/videos was written — ${CHANNEL.subscribers} subscribers and ${CHANNEL.videoCount} uploads at that moment. They do not refresh on their own.`}
            />
          </ul>
        </Reveal>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Limit({ title, detail }: { title: string; detail: string }) {
  return (
    <li className="border-t border-border pt-4 first:border-0 first:pt-0">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 leading-relaxed text-muted-foreground">{detail}</p>
    </li>
  );
}
