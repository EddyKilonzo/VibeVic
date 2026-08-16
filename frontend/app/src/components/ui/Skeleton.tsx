"use client";

import { cn } from "@/lib/utils";

/**
 * The skeleton family.
 *
 * Every skeleton here mirrors the real layout it stands in for — same grid,
 * same rhythm, same aspect ratios — so the page does not reflow when content
 * lands. That is the whole point: a spinner tells you to wait, a skeleton tells
 * you what you are waiting for.
 *
 * Two rules hold across all of them:
 *  - the shimmer is one shared CSS animation (`.skeleton`), which stops dead
 *    under `prefers-reduced-motion` and becomes a flat tint;
 *  - only the outermost skeleton of a screen carries `role="status"`, so a
 *    screen reader hears "Loading stories", not forty anonymous busy regions.
 */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={cn("skeleton", className)} style={style} />;
}

/** Ragged paragraph lines. The last line is short, the way real text is. */
export function TextSkeleton({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  const widths = ["w-full", "w-[97%]", "w-[91%]", "w-full", "w-[86%]", "w-[94%]"];
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5", i === lines - 1 ? "w-[62%]" : widths[i % widths.length])}
        />
      ))}
    </div>
  );
}

export function AvatarSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-10 w-10 rounded-full", className)} />;
}

/** A generic bordered card — used wherever a tile has no more specific shape. */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("surface p-5", className)}>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-6 w-28" />
      <Skeleton className="mt-4 h-3 w-full" />
    </div>
  );
}

/** Fixed-ratio box for anything that will become an image or an embed. */
export function MediaSkeleton({
  ratio = "16/9",
  className,
}: {
  ratio?: "16/9" | "16/10" | "1/1" | "4/5";
  className?: string;
}) {
  const aspect = {
    "16/9": "aspect-[16/9]",
    "16/10": "aspect-[16/10]",
    "1/1": "aspect-square",
    "4/5": "aspect-[4/5]",
  }[ratio];
  return <Skeleton className={cn("w-full rounded-lg shadow-card", aspect, className)} />;
}

export function StoryCardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <MediaSkeleton ratio="16/10" />
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-[92%]" />
        <Skeleton className="h-5 w-[64%]" />
        <Skeleton className="mt-1 h-3 w-40" />
      </div>
    </div>
  );
}

export function StoryGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Loading stories"
    >
      {Array.from({ length: count }, (_, i) => (
        <StoryCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function VideoGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Loading reports"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3.5">
          <MediaSkeleton />
          <Skeleton className="h-4 w-[88%]" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function ArticleSkeleton() {
  return (
    <div role="status" aria-label="Loading article">
      <div className="container-article pt-14">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-5 h-10 w-full" />
        <Skeleton className="mt-3 h-10 w-[70%]" />
        <Skeleton className="mt-7 h-4 w-56" />
      </div>
      <Skeleton className="mx-auto mt-10 aspect-[16/9] w-full max-w-[1100px]" />
      <div className="container-article mt-12">
        <TextSkeleton lines={5} className="gap-3.5" />
      </div>
    </div>
  );
}

/** The About page: portrait beside a stack of facts. */
export function ProfileSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading profile"
      className="container-page grid gap-10 pt-28 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:gap-14"
    >
      <MediaSkeleton ratio="4/5" className="max-w-[320px]" />
      <div>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-9 w-[70%]" />
        <Skeleton className="mt-3 h-9 w-[45%]" />
        <TextSkeleton lines={4} className="mt-8" />
        <div className="mt-10 flex flex-wrap gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Admin list view. Column widths match the real table so nothing jumps. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading table"
      className="surface overflow-hidden"
    >
      <div className="flex items-center gap-4 border-b border-border bg-muted/40 px-4 py-3">
        <Skeleton className="h-3 w-[38%]" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="ml-auto h-3 w-16" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-4 last:border-b-0">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-[70%]" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

/**
 * Charts get bars of varied height rather than a grey slab — a flat block reads
 * as a broken chart, and a fake-looking one reads as data that isn't there.
 * These heights are decorative and obviously so; no number is implied.
 */
export function ChartSkeleton({ className }: { className?: string }) {
  const bars = [42, 68, 31, 79, 55, 88, 47, 63];
  return (
    <div className={cn("surface p-5", className)}>
      <Skeleton className="h-3 w-32" />
      <div aria-hidden className="mt-6 flex h-40 items-end gap-2">
        {bars.map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard" className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-7 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ChartSkeleton />
        <div className="surface flex flex-col gap-4 p-5">
          <Skeleton className="h-3 w-28" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-12 rounded-sm" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The block editor: toolbar, title, then a column of block placeholders. */
export function EditorSkeleton() {
  return (
    <div role="status" aria-label="Loading editor" className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-3 w-40" />
        <Skeleton className="ml-auto h-8 w-24 rounded-md" />
      </div>
      <Skeleton className="h-11 w-[80%]" />
      <div className="flex flex-col gap-5">
        <TextSkeleton lines={3} />
        <MediaSkeleton ratio="16/9" />
        <TextSkeleton lines={4} />
      </div>
    </div>
  );
}
