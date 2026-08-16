"use client";

import Link from "next/link";
import { PencilRuler } from "lucide-react";
import { Reveal } from "@/components/motion";

/**
 * Marks template content as template content.
 *
 * The site ships with two written pieces so the editor and the voice player
 * have something to work on. They carry this banner wherever they render, so
 * placeholder text can never be mistaken for Victor's reporting. Clearing the
 * `placeholder` flag on a story removes it.
 */
export function PlaceholderNotice({ storyId }: { storyId?: string }) {
  return (
    <Reveal variant="fade" distance="sm">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-accent/50 bg-secondary/60 px-4 py-3 text-sm">
        <PencilRuler className="h-4 w-4 shrink-0 text-accent" aria-hidden />
        <p className="min-w-0 flex-1 text-muted-foreground">
          <span className="font-semibold text-primary">Template text.</span> This piece ships with
          the site to demonstrate the editor and the listen feature — it is not published
          reporting.
        </p>
        {storyId && (
          <Link
            href={`/admin/stories/${storyId}`}
            className="focus-ring underline-grow shrink-0 font-semibold text-primary"
          >
            Rewrite it
          </Link>
        )}
      </div>
    </Reveal>
  );
}
