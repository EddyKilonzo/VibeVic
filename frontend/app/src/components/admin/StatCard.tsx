"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp, Reveal } from "@/components/motion";

/**
 * A single figure, given room.
 *
 * The number is the content, so it gets the display face at a size nothing
 * else on the card competes with; the label and icon are support and stay
 * quiet. There is no sparkline and no percentage delta — this product records
 * a snapshot of channel figures, not a time series, and a trend arrow would be
 * inventing a comparison that does not exist.
 *
 * `caption` is the honest substitute: it says where the number came from.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  caption,
  delay = 0,
  accent = false,
  className,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  /** Where the figure comes from. Shown small, under the number. */
  caption?: string;
  delay?: number;
  /** One card per row may lead; more than one and none of them do. */
  accent?: boolean;
  className?: string;
}) {
  return (
    <Reveal
      variant="fade-up"
      distance="sm"
      delay={delay}
      className={cn(
        "surface surface-hover honeycomb honeycomb-strong relative overflow-hidden p-5",
        accent && "ring-1 ring-accent/25",
        className,
      )}
    >
      {/* The house hex, at object scale, catching the corner. */}
      <span
        aria-hidden
        className={cn(
          "absolute -right-7 -top-7 h-24 w-20 transition-colors duration-slow",
          accent ? "bg-accent/12" : "bg-primary/[0.06]",
        )}
        style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
      />

      <span
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-lg",
          accent ? "bg-accent text-accent-foreground" : "bg-secondary text-primary",
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>

      <p className="font-display relative mt-4 text-[2.1rem] font-semibold leading-none tracking-tight text-primary">
        <CountUp value={value} />
      </p>
      <p className="rule-label relative mt-2">{label}</p>
      {caption && (
        <p className="relative mt-2 text-[11px] leading-relaxed text-muted-foreground">{caption}</p>
      )}
    </Reveal>
  );
}
