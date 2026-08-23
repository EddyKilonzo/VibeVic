"use client";

import { useMemo } from "react";
import { useReducedMotion } from "motion/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { VIDEOS } from "@/data/videos";
import { LOCALE } from "@/lib/format";

/**
 * Views held by the catalogue, by publication month.
 *
 * ── What this is, precisely ──────────────────────────────────────────────
 * YouTube gives us each report's view count *as captured now*, not a history
 * of how those views accrued. So this is not a traffic chart, and calling it
 * one would be a lie that happens to look like a nice line going up.
 *
 * What it honestly shows: group every report by the month it was published,
 * then accumulate. Each step is "the reports published up to this month have
 * this many views between them today". That answers a real question — how much
 * of the channel's reach comes from which vintage of work — and the caption on
 * the card says so in as many words.
 *
 * A daily traffic series needs the YouTube Analytics API, which this product
 * is not connected to. Until it is, no chart here will pretend otherwise.
 */
export function ViewsTrend() {
  const reduced = useReducedMotion();

  const data = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const video of VIDEOS) {
      byMonth.set(video.published, (byMonth.get(video.published) ?? 0) + video.views);
    }

    // Accumulated with a reduce rather than a mutable counter closed over by
    // `map`: the lint rule is right that a variable reassigned during render
    // is a hazard, and the running total is genuinely a fold over the months.
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce<{ month: string; cumulative: number; added: number }[]>((rows, [month, views]) => {
        const [y, m] = month.split("-");
        const previous = rows[rows.length - 1]?.cumulative ?? 0;
        rows.push({
          month: new Date(Number(y), Number(m) - 1).toLocaleDateString(LOCALE, {
            month: "short",
            year: "2-digit",
          }),
          cumulative: previous + views,
          added: views,
        });
        return rows;
      }, []);
  }, []);

  // Two points is a slope, not a trend. Below three, the list of figures on
  // the rest of the page tells the reader more than a line would.
  if (data.length < 3) return null;

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-seq) / 0.28)" />
              <stop offset="100%" stopColor="hsl(var(--chart-seq) / 0)" />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 4" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            dy={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v: number) => v.toLocaleString(LOCALE)}
          />
          <Tooltip
            cursor={{ stroke: "hsl(var(--accent))", strokeWidth: 1, strokeDasharray: "3 3" }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid hsl(var(--border))",
              boxShadow: "var(--shadow-floating)",
              fontSize: 12,
              padding: "8px 10px",
            }}
            formatter={(value: number, name) => [
              value.toLocaleString(LOCALE),
              name === "cumulative" ? "Views to date" : "Added that month",
            ]}
          />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke="hsl(var(--chart-seq))"
            strokeWidth={2}
            fill="url(#trendFill)"
            // ≥8px markers, per the mark spec: with three points every one of
            // them matters and should be aimable.
            dot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))", fill: "hsl(var(--chart-seq))" }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: "hsl(var(--card))" }}
            isAnimationActive={!reduced}
            animationDuration={620}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
