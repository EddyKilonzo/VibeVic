"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AudioLines, Bot, Check, Copy, Mic, NotebookPen, Upload, X } from "lucide-react";
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
 * ── Where the transcript goes ────────────────────────────────────────────
 * Into `Interview.notes`, which is where the schema always said it should:
 * "Free notes. Transcripts, if a recording is ever made, live here too."
 * This panel previously claimed the column did not exist and that inventing
 * one would be a decision about what the newsroom keeps. The decision had
 * already been taken, in the DTO, before there was anything to put in it.
 *
 * So the meeting becomes an `Interview` row and the words become `Quote` rows
 * pointing back at it through `interviewId` — which is the shape the model
 * describes: "an interview record is the meeting, not the words". Filing the
 * interview is its own press, and quotes filed afterwards carry the link.
 * A quote filed before it is still a valid quote, simply unlinked; the panel
 * says which of the two is happening rather than deciding for the writer.
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
  /** The `Interview` row, once filed. Quotes link to it from then on. */
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [filingInterview, setFilingInterview] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const reduced = useReducedMotion();

  const send = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    setFiled({});
    // A new recording is a new meeting; carrying the last one's id over would
    // hang this tape's quotes off the previous interview.
    setInterviewId(null);
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

  /**
   * The meeting, filed as a record with the transcript in its notes.
   *
   * Its own press rather than something the first quote does implicitly. An
   * `Interview` row names who agreed to talk — which is why the schema
   * defaults it to CONFIDENTIAL, and why creating one as a side effect of
   * filing a quote would be this panel deciding to record a person's
   * co-operation without being asked to.
   */
  const fileInterview = async () => {
    if (!storyId || !result || interviewId) return;
    setFilingInterview(true);
    try {
      const response = await fetch("/api/newsroom/records/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewee: interviewee.trim() || "Unnamed interviewee",
          conductedAt: new Date().toISOString(),
          notes: result.transcript,
          storyIds: [storyId],
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `The newsroom returned ${response.status}.`);
      }
      const created = (await response.json()) as { id: string };
      setInterviewId(created.id);
      notify.success(
        "Interview filed",
        "The transcript is in its notes. Quotes filed from here on point back at it.",
      );
    } catch (cause) {
      notify.error(
        "Not filed",
        cause instanceof Error ? cause.message : "Could not reach the newsroom.",
      );
    } finally {
      setFilingInterview(false);
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
          // Present only once the meeting has a record to point at. The API
          // treats it as optional, so an unlinked quote is a complete quote
          // rather than a half-written one.
          ...(interviewId ? { interviewId } : {}),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `The newsroom returned ${response.status}.`);
      }
      setFiled((prev) => ({ ...prev, [index]: "kept" }));
      notify.success(
        "Quote filed",
        interviewId
          ? "Marked private, and linked to the interview."
          : "Marked private. File the interview to link it to the meeting.",
      );
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
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-primary">
          <Mic className="h-5 w-5" aria-hidden />
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
                      {result.language}.{" "}
                      {interviewId
                        ? "Filed in the interview's notes."
                        : "Not filed yet — file the interview below to keep it."}
                    </p>
                    <div
                      data-lenis-prevent
                      className="mt-2.5 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3.5 text-[13px] leading-relaxed text-foreground"
                    >
                      {result.transcript}
                    </div>

                    {/* The meeting, as its own record and its own press.

                        `Interview` is the row that names who agreed to talk,
                        which is why the schema defaults it to CONFIDENTIAL —
                        and why creating one as a side effect of filing a
                        quote would be this panel recording somebody's
                        co-operation without being asked to. */}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Button
                        size="sm"
                        variant={interviewId ? "outline" : "primary"}
                        disabled={filingInterview || interviewId !== null}
                        onClick={() => void fileInterview()}
                      >
                        {interviewId ? (
                          <>
                            <Check className="h-3.5 w-3.5" aria-hidden />
                            Interview filed
                          </>
                        ) : (
                          <>
                            <NotebookPen className="h-3.5 w-3.5" aria-hidden />
                            {filingInterview ? "Filing…" : "File the interview"}
                          </>
                        )}
                      </Button>
                      <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">
                        {interviewId
                          ? "The meeting is in Records under Interviews, with this transcript in its notes. Quotes filed below point back at it."
                          : "Keeps the transcript in the interview's notes and gives the quotes below something to point at. Marked confidential, like every interview record."}
                      </p>
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
