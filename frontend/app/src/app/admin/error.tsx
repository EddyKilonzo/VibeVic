"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/States";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin]", error);
  }, [error]);

  return (
    <ErrorState
      title="This view didn't load."
      description="Nothing was saved or lost — the workspace only failed to render."
      onRetry={reset}
    />
  );
}
