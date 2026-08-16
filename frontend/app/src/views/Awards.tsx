"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { AWARDS } from "@/data/content";
import { cn } from "@/lib/utils";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { EmptyState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";

/**
 * Awards.
 *
 * Ships empty on purpose. Listing a prize that has not been won would be a
 * fabricated credential, so the page shows an honest empty state and the
 * timeline below renders as soon as real entries are added in the admin.
 */
export default function Awards() {
  return (
    <div className="container-site pt-32 sm:pt-40">
      <Reveal variant="fade-up">
        <p className="rule-label">Recognition</p>
        <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Awards
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Nominations, prizes and recognition for the reporting.
        </p>
      </Reveal>

      {AWARDS.length === 0 ? (
        <div className="mt-16">
          <EmptyState
            icon={<Trophy className="h-5 w-5" aria-hidden />}
            title="Nothing listed yet"
            description="Awards and nominations will appear here once they're added. Nothing has been listed that hasn't been won."
            action={
              <Button as={Link} href="/admin/awards" variant="outline" size="sm">
                Add an award
              </Button>
            }
          />
        </div>
      ) : (
        /* Timeline: the rule runs down the page as the items arrive. */
        <Stagger className="relative mt-16 pl-8 sm:pl-12" step="loose">
          <span
            aria-hidden
            className="absolute left-[3px] top-2 h-full w-px bg-border sm:left-[7px]"
          />

          {AWARDS.map((award, i) => (
            <StaggerItem key={`${award.year}-${award.title}`} index={i}>
              <Reveal variant="fade-left" as="article" className="relative pb-12 last:pb-0">
                <span
                  aria-hidden
                  className={cn(
                    "absolute -left-8 top-2 h-[7px] w-[7px] rounded-full sm:-left-12",
                    award.result === "Winner" ? "bg-accent" : "bg-border",
                  )}
                />

                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-display text-3xl font-semibold tabular-nums text-primary">
                    {award.year}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em]",
                      award.result === "Winner"
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-primary",
                    )}
                  >
                    {award.result}
                  </span>
                </div>

                <h2 className="font-display mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
                  {award.title}
                </h2>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">{award.body}</p>
                <p className="mt-2 max-w-xl leading-relaxed text-muted-foreground">
                  {award.description}
                </p>
              </Reveal>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
