"use client";

import { Suspense, type ReactNode } from "react";
import type { Genre } from "@/data/types";
import { Toaster } from "sonner";
import { BookmarksProvider } from "@/context/BookmarksProvider";
import { TaxonomyProvider } from "@/context/TaxonomyProvider";
import { VoiceProvider } from "@/context/VoiceProvider";
import { RouteProgress } from "@/components/loading/RouteProgress";

/**
 * The single client boundary at the root of the app.
 *
 * Bookmarks and voice both have to outlive a route change — speech synthesis
 * is a global, single-voice resource, and a story must keep playing while the
 * reader navigates within it. Everything else stays a server component.
 *
 * Taxonomy wraps them because it is data rather than behaviour: fetched once
 * on the server, handed down as a prop, and read synchronously by every
 * component that has to name a beat while it draws.
 */
export function AppProviders({
  genres,
  children,
}: {
  /** The beat tree, read from the API by the root layout on the server. */
  genres: Genre[];
  children: ReactNode;
}) {
  return (
    <TaxonomyProvider genres={genres}>
    <BookmarksProvider>
      <VoiceProvider>
        {/* RouteProgress reads the query string to know when a navigation has
            landed. That has to sit behind Suspense or it would opt every page
            out of static rendering — for a 2px bar that isn't drawn yet. */}
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        {children}

        {/* One toaster for the whole app — every confirmation routes through
            lib/toast.ts so they all look and last the same. */}
        <Toaster
          position="bottom-center"
          offset={16}
          toastOptions={{
            className: "font-sans",
            style: {
              borderRadius: "6px",
              border: "1px solid hsl(214 20% 90%)",
              fontSize: "13px",
            },
          }}
        />
      </VoiceProvider>
    </BookmarksProvider>
    </TaxonomyProvider>
  );
}
