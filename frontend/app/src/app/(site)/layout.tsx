import type { ReactNode } from "react";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { HoneycombGround } from "@/components/texture/HoneycombGround";

/**
 * The public shell.
 *
 * Header and footer live here rather than in each page so they survive route
 * changes: the masthead keeps its scroll state, and the reader never sees the
 * chrome flash out and back in between two articles. Only `<main>` swaps.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    // The lattice lives on the page ground itself, so every route sits on the
    // same stock and no page has to remember to ask for it. `HoneycombGround`
    // adds the pointer response on top of the same layer.
    <HoneycombGround className="flex min-h-screen flex-col">
      <PublicHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </HoneycombGround>
  );
}
