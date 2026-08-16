"use client";

import { ArrowUpRight } from "lucide-react";
import { PUBLICATIONS } from "@/data/content";
import { Reveal } from "@/components/motion";
import { ScrollStack, ScrollStackItem } from "@/components/reactbits";

export default function Publications() {
  return (
    <div className="container-site pt-32 sm:pt-40">
      <Reveal variant="fade-up">
        <p className="rule-label">Where the work runs</p>
        <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Platforms
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Where the reporting is published, and where it was trained.
        </p>
      </Reveal>

      {/* Each platform is a card that pins and stacks as the next one arrives.
          The page is a short, ordered list of a handful of things — exactly
          the shape the stack reads well at, and the one place on the site
          where a scroll-driven sequence adds information (order) rather than
          just motion. Under reduced motion it falls back to a plain column. */}
      <ScrollStack className="mt-16">
        {PUBLICATIONS.map((publication) => (
          <ScrollStackItem key={publication.name} className="surface p-7 sm:p-9">
            <article>
              <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
                <div>
                  <h2 className="font-display text-2xl font-semibold tracking-tight">
                    {publication.url ? (
                      <a
                        href={publication.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="focus-ring group inline-flex items-start gap-1.5"
                      >
                        <span className="underline-grow">{publication.name}</span>
                        <ArrowUpRight
                          className="nudge-x mt-1.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-accent"
                          aria-hidden
                        />
                      </a>
                    ) : (
                      publication.name
                    )}
                  </h2>
                  <p className="rule-label mt-2">{publication.period}</p>
                </div>
                <div>
                  <p className="font-semibold text-primary">{publication.role}</p>
                  <p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">
                    {publication.description}
                  </p>
                </div>
              </div>
            </article>
          </ScrollStackItem>
        ))}
      </ScrollStack>
    </div>
  );
}
