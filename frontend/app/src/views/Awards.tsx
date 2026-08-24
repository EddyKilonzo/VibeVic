"use client";

import { Trophy } from "lucide-react";
import type { Award } from "@/data/types";
import { cn } from "@/lib/utils";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { EmptyState } from "@/components/ui/States";
import { PageHero } from "@/components/hero/PageHero";
import { AtmosphereBand } from "@/components/ui/AtmosphereBand";
import { RECOGNITION_ATMOSPHERE } from "@/data/imagery";

/**
 * Awards.
 *
 * Ships empty on purpose. Listing a prize that has not been won would be a
 * fabricated credential, so the page shows an honest empty state and the
 * timeline below renders as soon as real entries are added in the admin.
 */
export default function Awards({ awards }: { awards: Award[] }) {
  return (
    <>
      <PageHero
        label="Recognition"
        title="Awards"
        lead="Nominations, prizes and recognition for the reporting."
      />

      <div className="container-site mt-16">
        <AtmosphereBand image={RECOGNITION_ATMOSPHERE} className="mb-12" height="min-h-[200px]">
          <p className="rule-label text-brand-sky">Recognition</p>
          <p className="font-display mt-2 max-w-[40ch] text-xl font-semibold leading-snug text-white sm:text-2xl">
            Entries are added as they happen. Nothing is listed here that has not been awarded.
          </p>
        </AtmosphereBand>


      {awards.length === 0 ? (
        <div className="mt-16">
          <EmptyState
            icon={<Trophy className="h-5 w-5" aria-hidden />}
            title="Nothing listed yet"
            description="Awards and nominations will appear here once they're added. Nothing has been listed that hasn't been won."
          />
        </div>
      ) : (
        /* Timeline: the rule runs down the page as the items arrive. */
        <Stagger className="relative mt-16 pl-8 sm:pl-12" step="loose">
          <span
            aria-hidden
            className="absolute left-[3px] top-2 h-full w-px bg-border sm:left-[7px]"
          />

          {awards.map((award, i) => (
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

                <h2 className="font-display display-3 mt-3 font-semibold">
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
    </>
  );
}
