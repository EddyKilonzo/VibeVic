"use client";

import { useState } from "react";
import { AlertCircle, Sparkles } from "lucide-react";
import type { Pitch, PitchResult } from "./pitch";
import { Button } from "@/components/ui/Button";

/**
 * The trigger, and nothing else.
 *
 * The result used to render directly beneath this button, in the 360px form
 * column, which meant three angles, five sources and four questions stacked
 * into a strip narrower than the phone this site is mostly read on. The panel
 * lives in the main column now (`PitchPanel`), where there is width to read
 * it; this stays where the idea is typed, because that is where the writer is
 * when they want it worked up.
 */
export function PitchDesk({
  idea,
  note,
  onResult,
}: {
  idea: string;
  note: string;
  onResult: (result: PitchResult) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch("/api/newsroom/pitch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idea, note }),
      });
      const data = (await response.json()) as Pitch & { error?: string };
      if (!response.ok) {
        setProblem(data.error ?? "That did not work.");
        return;
      }
      onResult({ pitch: data, subject: idea });
    } catch {
      setProblem("The request never left the browser. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 border-t border-border pt-5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={run}
        disabled={!idea.trim() || busy}
        loading={busy}
        loadingText="Working it up"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Work up this idea
      </Button>

      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        Angles, who to call and the questions it has to answer — suggestions, not reporting.
        Nothing is saved unless you put it somewhere.
      </p>

      {problem && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 text-[11px] leading-snug text-destructive"
        >
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          {problem}
        </p>
      )}
    </div>
  );
}
