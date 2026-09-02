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

      /*
       * Parsed defensively, and this is a fix rather than a precaution.
       *
       * `await response.json()` used to be the first thing here, outside any
       * guard — so a reply that was not JSON threw, fell into the catch
       * below, and was reported as "the request never left the browser". It
       * had left; it had reached the server, which had then been killed
       * mid-model-call and had answered with a gateway error page. The one
       * failure most likely to happen was described by the one message that
       * could not be true of it, and it sent whoever read it to check their
       * wifi.
       *
       * The route answers JSON for every failure it is alive to handle. A
       * body that is not JSON therefore means the route did not get to reply
       * at all, which is a different thing and now says so.
       */
      const data = (await response.json().catch(() => null)) as
        | (Pitch & { error?: string })
        | null;

      if (!response.ok) {
        setProblem(
          data?.error ??
            `The newsroom answered ${response.status} without an explanation. Nothing was saved.`,
        );
        return;
      }

      if (!data) {
        setProblem(
          "The server was cut off before it could answer — usually the model taking longer than this deployment allows. Nothing was saved.",
        );
        return;
      }

      onResult({ pitch: data, subject: idea });
    } catch {
      // Genuinely the browser now: DNS, offline, a cancelled navigation. The
      // cases that used to be swept in here have their own sentences above.
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
        {/* Said before the wait rather than after it. The free tier this runs
            on queues, and a minute of a spinner with no warning reads as a
            hang — which is how a working feature gets reported as broken. */}
        {busy && " This can take a minute or more; leave the tab open."}
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
