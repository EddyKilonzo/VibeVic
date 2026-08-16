"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/States";

/**
 * A render error inside the public shell. The header and footer stay mounted,
 * so the reader keeps their way out and only the article area is replaced.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[site]", error);
  }, [error]);

  return (
    <div className="container-article pt-40">
      <ErrorState
        title="This page didn't load."
        description="Something broke while rendering. Trying again usually fixes it."
        onRetry={reset}
      />
    </div>
  );
}
