"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Eye, FileText, Headphones, PenLine, Youtube } from "lucide-react";
import { TOP_BEATS, STORIES, storyBySlug } from "@/data/content";
import { CHANNEL, VIDEOS, totalViews } from "@/data/videos";
import { summariseAll } from "@/lib/voice/analytics";
import { LOCALE, formatCompact, formatPercent, formatTime } from "@/lib/format";
import { Reveal } from "@/components/motion";
import { StatCard } from "@/components/admin/StatCard";
import { BeatShare } from "@/components/admin/BeatShare";
import { ViewsTrend } from "@/components/admin/ViewsTrend";
import { EmptyState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";

/**
 * Newsroom overview.
 *
 * Two sources, both real: the channel figures captured from YouTube, and
 * locally recorded audio playback. Nothing on this page is modelled — where
 * there is no data, it says so rather than drawing a zeroed chart.
 */
export default function Dashboard() {
  const reduced = useReducedMotion();

  const drafts = STORIES.filter((s) => s.status !== "published").length;
  const published = STORIES.length - drafts;

  const chartData = useMemo(
    () =>
      [...VIDEOS]
        .sort((a, b) => b.views - a.views)
        .map((v) => ({
          name: v.title.length > 30 ? `${v.title.slice(0, 30)}…` : v.title,
          views: v.views,
          id: v.id,
        })),
    [],
  );

  // Real, locally recorded playback — not seeded, not modelled.
  const audio = useMemo(() => summariseAll(), []);

  return (
    <div className="mx-auto max-w-[1440px]">
      <Reveal variant="fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="rule-label">Overview</p>
            <h1 className="font-display display-2 mt-2 font-semibold">
              Welcome back, Victor
            </h1>
          </div>
          <div className="flex gap-2">
            <Button
              as="a"
              href={CHANNEL.url}
              target="_blank"
              rel="noreferrer noopener"
              variant="outline"
              size="sm"
            >
              <Youtube className="icon-tilt h-4 w-4" aria-hidden />
              Channel
            </Button>
            <Button as={Link} href="/admin/stories/new" size="sm">
              <PenLine className="icon-lean h-4 w-4" aria-hidden />
              New story
            </Button>
          </div>
        </div>
      </Reveal>

      {/* Four figures, each a card. No trend arrows: this product holds a
          snapshot of channel figures, not a time series, and a delta would be
          a comparison against data that does not exist. */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Reports published"
          value={CHANNEL.videoCount}
          icon={Youtube}
          caption={`On ${CHANNEL.handle}`}
          accent
        />
        <StatCard
          label="Total views"
          value={totalViews()}
          icon={Eye}
          caption="Across every report"
          delay={70}
        />
        <StatCard
          label="Subscribers"
          value={CHANNEL.subscribers}
          icon={Headphones}
          caption="At last capture"
          delay={140}
        />
        {/* The written archive exists now — five imported pieces — and the
            dashboard had no view of it at all. A newsroom overview that counts
            only video is describing half the work. Drafts moved into the
            caption because the number is currently zero, and a zeroed card in
            a row of four reads as something broken rather than as nothing
            outstanding. */}
        <StatCard
          label="Written pieces"
          value={published}
          icon={FileText}
          caption={drafts > 0 ? `${drafts} in draft` : "All published"}
          delay={210}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        {/* Lead panel: the only chart with a time axis, given the widest span. */}
        <Reveal variant="fade-up" className="surface p-5 lg:col-span-7">
          <p className="rule-label">Views by publication month</p>
          <p className="mt-1 max-w-[52ch] text-sm text-muted-foreground">
            Reports grouped by the month they went out, accumulated. These are
            today&rsquo;s view counts by vintage of work — not a traffic history, which
            would need the YouTube Analytics API.
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
          {/* Reads the real list. It said "the four subjects" for a while
              after there were seven, which is the failure mode of writing a
              count into a sentence. */}
          <p className="mt-1 text-sm text-muted-foreground">
            Reports and writing together, across all {TOP_BEATS.length} beats.
          </p>
          <div className="mt-6">
            <BeatShare />
          </div>
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:mt-5 lg:grid-cols-12 lg:gap-5">
        <Reveal variant="fade-up" className="surface p-5 lg:col-span-7">
          <p className="rule-label">Views by report</p>
          <p className="mt-1 text-sm text-muted-foreground">
            As published on {CHANNEL.handle}.
          </p>

          <div className="mt-6 h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 44 }}>
                <defs>
                  {/* One hue, light to dark along the bar: the colour is
                      carrying magnitude, not identity. */}
                  <linearGradient id="barFill" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(var(--chart-seq) / 0.55)" />
                    <stop offset="100%" stopColor="hsl(var(--chart-seq))" />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  horizontal={false}
                  stroke="hsl(var(--border))"
                  strokeDasharray="2 4"
                />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={190}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "hsl(220 9% 44%)" }}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--secondary) / 0.6)" }}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid hsl(var(--border))",
                    boxShadow: "var(--shadow-floating)",
                    fontSize: 12,
                    padding: "8px 10px",
                  }}
                  formatter={(value: number) => [value.toLocaleString(LOCALE), "Views"]}
                />
                {/* Recharts' own entrance, held to the system's slow token and
                    switched off entirely under reduced motion. */}
                <Bar
                  dataKey="views"
                  fill="url(#barFill)"
                  radius={[0, 4, 4, 0]}
                  barSize={13}
                  isAnimationActive={!reduced}
                  animationDuration={620}
                  animationEasing="ease-out"
                >
                  {/* Selective direct labels: the value at the end of each
                      bar, so the axis can stay unlabelled and recessive. */}
                  <LabelList
                    dataKey="views"
                    position="right"
                    className="fill-muted-foreground"
                    fontSize={11}
                    formatter={(v: number) => v.toLocaleString(LOCALE)}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Reveal>

        {/* Audio analytics — real recorded playback only. */}
        <Reveal variant="fade-up" delay={70} className="surface p-5 lg:col-span-5">
          <p className="rule-label">Listening on this device</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Recorded as written pieces are played aloud.
          </p>

          {audio.length === 0 ? (
            <EmptyState
              icon={<Headphones className="h-5 w-5" aria-hidden />}
              title="No playback recorded yet"
              description="Play a written piece with the voice player and its completion rate, average duration and preferred speed will appear here."
              className="mt-6 border-0 bg-transparent px-0 py-8"
            />
          ) : (
            <ul className="mt-5 space-y-4">
              {audio.map((summary) => {
                // The panel was printing `summary.slug` — the URL segment, so
                // this read as a list of
                // "from-imposter-syndrome-to-breakthroughs-the-untold-…".
                // Playback is recorded against the slug because that is the
                // stable key; the headline is what the person reading this
                // knows the piece by.
                const story = storyBySlug(summary.slug);
                return (
                <li
                  key={summary.slug}
                  className="border-t border-border pt-4 first:border-0 first:pt-0"
                >
                  <Link
                    href={`/stories/${summary.slug}`}
                    className="focus-ring underline-grow text-sm font-semibold"
                  >
                    {story?.title ?? summary.slug}
                  </Link>
                  {/* A recording whose piece is no longer in the archive.
                      Kept and labelled rather than dropped — the playback
                      happened, and silently hiding it would misstate the
                      totals underneath. */}
                  {!story && (
                    <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                      no longer published
                    </span>
                  )}
                  <dl className="mt-2 grid grid-cols-3 gap-3 text-xs">
                    <Metric label="Plays" value={String(summary.plays)} />
                    <Metric label="Completion" value={formatPercent(summary.completionRate)} />
                    <Metric label="Avg listen" value={formatTime(summary.avgSeconds)} />
                  </dl>
                  {summary.commonRate && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Most-used speed {summary.commonRate}×
                    </p>
                  )}
                </li>
                );
              })}
            </ul>
          )}

          <p className="mt-6 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
            {formatCompact(totalViews())} total video views across {VIDEOS.length} reports.
          </p>
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
