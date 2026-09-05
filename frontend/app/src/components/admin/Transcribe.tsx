"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AudioLines, Bot, Check, Copy, Mic, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { transitions } from "@/lib/motion";
import { notify } from "@/lib/toast";

/**
 * An interview recording, turned into a transcript and quotes worth filing.
 *
 * ── Why this panel says what happens to the tape ─────────────────────────
 * Prominently, above the file picker, and not in a settings page nobody
 * opens. A journalist deciding whether to put a source's recorded voice
 * through a model is making a source-protection decision, and the only
 * moment that decision can be made honestly is before the file is chosen.
 * The route keeps nothing; this is where that promise has to be legible.
 *
 * ── One quote at a time, each with its own accept ────────────────────────
 * There is no "file all". A machine-transcribed quote committed in bulk is a
 * quotation mark around words nobody listened back to, and the whole reason
 * the transcript is shown beside the candidates is so the journalist can
 * check one against the other before any of it becomes a record.
 *
 * ── The transcript is not filed anywhere ─────────────────────────────────
 * It is shown, and it can be copied. Filing it would need a column that does
 * not exist, and inventing one to hold a machine's draft of what somebody
 * said is not a small schema change — it is a decision about what this
 * newsroom keeps. The quotes are the reporting record; the transcript is
 * working material, and it lives in this panel until the tab is closed.
 */

interface Quote {
  text: string;
  speaker: string;
  atSeconds: number;
  uncertain?: string;
}

interface Result {
  transcript: string;
  language: string;
  quotes: Quote[];
}

export function Transcribe({ storyId }: { storyId: string | null }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [filed, setFiled] = useState<Record<number, "kept" | "dropped">>({});
  const [interviewee, setInterviewee] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const reduced = useReducedMotion();

  const send = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    setFiled({});
    try {
      const form = new FormData();
      form.append("audio", file);
      if (interviewee.trim()) form.append("interviewee", interviewee.trim());

      const response = await fetch("/api/newsroom/assist/transcribe", {
        method: "POST",
        body: form,
        cache: "no-store",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `The newsroom returned ${response.status}.`);
        return;
      }
      setResult((await response.json()) as Result);
    } catch {
      setError("Could not reach the newsroom. Nothing was sent anywhere else either.");
    } finally {
      setBusy(false);
      // Cleared so choosing the same file again re-runs rather than doing
      // nothing, which is what an unchanged input value would do.
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const file = async (quote: Quote, index: number) => {
    if (!storyId) return;
    try {
      const response = await fetch("/api/newsroom/records/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: quote.text,
          speaker: quote.speaker,
          visibility: "PRIVATE",
          storyIds: [storyId],
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `The newsroom returned ${response.status}.`);
      }
      setFiled((prev) => ({ ...prev, [index]: "kept" }));
      notify.success("Quote filed", "It is in the record for this piece, marked private.");
    } catch (cause) {
      notify.error(
        "Not filed",
        cause instanceof Error ? cause.message : "Could not reach the newsroom.",
      );
    }
  };

  return (
    <section className="surface mt-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="focus-ring flex w-full items-center gap-3 p-5 text-left transition-colors duration-normal hover:bg-secondary/50"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
          <Mic className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            Transcribe a recording
          </span>
          <span className="block text-[12px] text-muted-foreground">
            An interview becomes a transcript and quotes you can file. The recording is not kept.
          </span>
        </span>
        <span className="text-[12px] font-semibold text-muted-foreground">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduced ? undefined : { opacity: 0, height: 0 }}
            transition={transitions.normal}
            className="overflow-hidden"
          >
            <div className="border-t border-border p-5">
              {/* Said before the file picker, not after it. Choosing the file
                  is the moment the decision is actually made. */}
              <p className="max-w-[68ch] rounded-lg border border-border bg-secondary/40 p-3.5 text-[12px] leading-relaxed text-muted-foreground">
                The recording is sent to the model, transcribed, and discarded when the answer
                comes back. It is not uploaded to your media library and nothing here keeps a
                copy — a raw interview tape is the most sensitive thing a newsroom holds, and
                this product is not the place it lives. Which also means there is no re-run
                without the file: keep it on your own machine.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="block">
                  <span className="rule-label">Who is being interviewed</span>
                  <input
                    value={interviewee}
                    onChange={(event) => setInterviewee(event.target.value)}
                    placeholder="Optional — a name is never guessed from the audio"
                    className="surface-compact focus-ring mt-1.5 h-10 w-full bg-transparent px-3 text-sm outline-none"
                  />
                </label>

                <div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="audio/*,video/mp4,video/webm"
                    className="sr-only"
                    onChange={(event) => {
                      const chosen = event.target.files?.[0];
                      if (chosen) void send(chosen);
                    }}
                  />
                  <Button
                    onClick={() => fileInput.current?.click()}
                    disabled={busy}
                    className="w-full sm:w-auto"
                  >
                    <Upload className="h-4 w-4" aria-hidden />
                    {busy ? "Transcribing…" : "Choose a recording"}
                  </Button>
                </div>
              </div>

              {busy && (
                <p className="mt-4 inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                  <AudioLines className="h-4 w-4 animate-pulse text-accent" aria-hidden />
                  Listening to the recording. Twenty minutes of tape takes a few seconds.
                </p>
              )}

              {error && (
                <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/[0.06] p-3.5 text-[13px] leading-relaxed text-muted-foreground">
                  {error}
                </p>
              )}

              {result && (
                <div className="mt-6 space-y-5">
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                    <Bot className="h-3 w-3" aria-hidden />
                    Machine transcript — check it against the tape before filing anything
                  </p>

                  <div>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className="font-display text-[15px] font-semibold tracking-tight text-foreground">
                        Transcript
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(result.transcript);
                          notify.success("Transcript copied", "Paste it wherever you keep notes.");
                        }}
                        className="focus-ring inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-primary"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                        Copy
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {result.language}. This is not saved anywhere — copy it if you want it.
                    </p>
                    <div
                      data-lenis-prevent
                      className="mt-2.5 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3.5 text-[13px] leading-relaxed text-foreground"
                    >
                      {result.transcript}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-display text-[15px] font-semibold tracking-tight text-foreground">
                      Worth quoting
                    </h4>
                    <p className="mt-1 max-w-[62ch] text-[11px] leading-snug text-muted-foreground">
                      Filed one at a time and never in bulk. A quote committed without somebody
                      listening back to it is a quotation mark around words nobody verified.
                    </p>

                    {result.quotes.length === 0 ? (
                      <p className="mt-3 text-[13px] text-muted-foreground">
                        Nothing in this recording read as a usable quote.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2.5">
                        {result.quotes.map((quote, index) => {
                          const state = filed[index];
                          return (
                            <li
                              key={index}
                              className={
                                state
                                  ? "rounded-lg border border-border bg-secondary/40 p-3.5 opacity-60"
                                  : "rounded-lg border border-border bg-background p-3.5"
                              }
                            >
                              <div className="flex flex-wrap items-baseline gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  {quote.speaker}
                                </span>
                                <span className="text-[11px] tabular-nums text-muted-foreground">
                                  at {stamp(quote.atSeconds)}
                                </span>
                              </div>
                              <p className="mt-1.5 max-w-[68ch] text-[13px] leading-relaxed text-foreground">
                                {quote.text}
                              </p>
                              {quote.uncertain && (
                                <p className="mt-1.5 max-w-[68ch] text-[12px] leading-relaxed text-accent-foreground/80">
                                  Uncertain: {quote.uncertain}
                                </p>
                              )}

                              {state ? (
                                <p className="mt-2.5 text-[12px] font-semibold text-muted-foreground">
                                  {state === "kept" ? "Filed as a quote" : "Dismissed"}
                                </p>
                              ) : (
                                <div className="mt-3 flex gap-2">
                                  <Button size="sm" onClick={() => void file(quote, index)}>
                                    <Check className="h-3.5 w-3.5" aria-hidden />
                                    File this quote
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setFiled((prev) => ({ ...prev, [index]: "dropped" }))
                                    }
                                  >
                                    <X className="h-3.5 w-3.5" aria-hidden />
                                    Not this
                                  </Button>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** m:ss, because a timestamp in raw seconds is not a place in a recording. */
function stamp(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
