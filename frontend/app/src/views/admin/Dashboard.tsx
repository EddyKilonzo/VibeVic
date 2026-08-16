"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Eye, FileText, Headphones, PenLine, Youtube } from "lucide-react";
import { STORIES } from "@/data/content";
import { CHANNEL, VIDEOS, totalViews } from "@/data/videos";
import { summariseAll } from "@/lib/voice/analytics";
import { formatCompact, formatPercent, formatTime } from "@/lib/format";
import { CountUp, Reveal, Stagger, StaggerItem } from "@/components/motion";
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
    <div className="mx-auto max-w-[1200px]">
      <Reveal variant="fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="rule-label">Overview</p>
            <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">
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
              <Youtube className="h-4 w-4" aria-hidden />
              Channel
            </Button>
            <Button as={Link} href="/admin/stories/new" size="sm">
              <PenLine className="h-4 w-4" aria-hidden />
              New story
            </Button>
          </div>
        </div>
      </Reveal>

      {/* Stat tiles — each number counts once, on arrival. */}
      <Stagger className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Reports published", value: CHANNEL.videoCount, icon: Youtube },
          { label: "Total views", value: totalViews(), icon: Eye },
          { label: "Subscribers", value: CHANNEL.subscribers, icon: Headphones },
          { label: "Drafts in progress", value: drafts, icon: FileText },
        ].map((stat, i) => (
          <StaggerItem key={stat.label} index={i}>
            <Reveal variant="fade-up" distance="sm" className="bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="rule-label">{stat.label}</p>
                <stat.icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              </div>
              <p className="font-display mt-3 text-3xl font-semibold tracking-tight text-primary">
                <CountUp value={stat.value} />
              </p>
            </Reveal>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Reveal variant="fade-up" className="surface p-5">
          <p className="rule-label">Views by report</p>
          <p className="mt-1 text-sm text-muted-foreground">
            As published on {CHANNEL.handle}.
          </p>

          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 20 }}>
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
                  cursor={{ fill: "hsl(205 92% 94% / 0.5)" }}
                  contentStyle={{
                    borderRadius: 6,
                    border: "1px solid hsl(214 20% 90%)",
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [value.toLocaleString(), "Views"]}
                />
                {/* Recharts' own entrance, held to the system's slow token and
                    switched off entirely under reduced motion. */}
                <Bar
                  dataKey="views"
                  fill="hsl(207 90% 54%)"
                  radius={[0, 3, 3, 0]}
                  barSize={14}
                  isAnimationActive={!reduced}
                  animationDuration={620}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Reveal>

        {/* Audio analytics — real recorded playback only. */}
        <Reveal variant="fade-up" delay={80} className="surface p-5">
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
              {audio.slice(0, 5).map((summary) => (
                <li
                  key={summary.slug}
                  className="border-t border-border pt-4 first:border-0 first:pt-0"
                >
                  <Link
                    href={`/stories/${summary.slug}`}
                    className="focus-ring underline-grow text-sm font-semibold"
                  >
                    {summary.slug}
                  </Link>
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
              ))}
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
