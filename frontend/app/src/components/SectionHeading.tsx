"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/motion";

export interface SectionHeadingProps {
  label: string;
  title: string;
  description?: string;
  action?: { href: string; label: string };
  className?: string;
}

/**
 * Every section opens the same way: a rule label, a display heading, and an
 * optional link out. Consistency here is what lets the reveals be so quiet —
 * the reader learns the shape once and stops noticing it.
 */
export function SectionHeading({
  label,
  title,
  description,
  action,
  className,
}: SectionHeadingProps) {
  return (
    <Reveal variant="fade-up" className={cn("border-t border-border pt-6", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="rule-label">{label}</p>
          <h2 className="font-display mt-2.5 text-3xl font-semibold tracking-tight text-balance sm:text-[2.5rem]">
            {title}
          </h2>
          {description && (
            <p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>

        {action && (
          <Link
            href={action.href}
            className="focus-ring group inline-flex shrink-0 items-center gap-2 pb-1 text-sm font-semibold text-primary"
          >
            <span className="underline-grow">{action.label}</span>
            <ArrowUpRight className="nudge-x h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>
    </Reveal>
  );
}
