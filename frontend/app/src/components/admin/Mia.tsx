"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useNewsroomSession } from "@/components/admin/SessionContext";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";

/**
 * Mia — the assistant, in a panel that is out of the way until it is not.
 *
 * ── Why a dock and not a page ────────────────────────────────────────────
 * The questions she is for are asked *while* doing something else: "what is
 * due this week", "which draft did I touch last", "is the database
 * reachable". Every one of those is a thing you want without leaving the
 * screen you are on, and a page you have to navigate to is a page you check
 * instead of working, which is the opposite of the point.
 *
 * ── She is grounded, and the panel shows the grounding ───────────────────
 * Every answer is followed by what she was actually reading — "stories,
 * deadlines, ideas, streak". An assistant that shows its sources is one a
 * journalist can check, and if the list is missing something, the answer that
 * did not mention it was not hiding anything, it could not see it.
 *
 * That is also why a failed model call still shows a briefing. Most of what
 * gets asked here is answerable by reading the figures, and going silent
 * because a third party is rate-limited would be the panel protecting its own
 * dignity at the reader's expense.
 *
 * ── What she is not allowed to be ────────────────────────────────────────
 * No streaming typewriter, no avatar, no "Hi! How can I help you today?".
 * This is a tool inside somebody's working day; the personality it needs is
 * the personality of a good colleague, which is mostly restraint. She also
 * cannot act — there is nothing behind her but a read — so nothing in this
 * panel is a button that changes anything.
 */

interface Answer {
  answer?: string;
  error?: string;
  used?: string[];
  failures?: string[];
  briefing?: string[];
}

/** Openers, chosen because each is answerable entirely from the briefing. */
const WRITER_PROMPTS = [
  "What is due this week?",
  "Which draft did I touch last?",
  "How am I doing on showing up?",
];

const DEV_PROMPTS = [
  "Is anything wrong with the deployment?",
  "Did the migrations run?",
  "What is scheduled to go out?",
];

export function Mia() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<Answer | null>(null);
  const reduced = useReducedMotion();
  const { role } = useNewsroomSession();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the field when the panel opens, because the only reason to open it
  // is to type. Guarded on `open` so it never steals focus from the editor.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const ask = async (asked: string) => {
    const text = asked.trim();
    if (!text || asking) return;

    setAsking(true);
    setResult(null);
    try {
      const response = await fetch("/api/newsroom/mia", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ question: text }),
        cache: "no-store",
      });
      // Both branches carry a body worth showing: on failure it holds the
      // briefing she was reading, which is often the answer.
      setResult((await response.json()) as Answer);
    } catch {
      setResult({ error: "Could not reach the newsroom. Nothing has changed." });
    } finally {
      setAsking(false);
    }
  };

  const prompts = role === "DEV" ? DEV_PROMPTS : WRITER_PROMPTS;

  return (
    <>
      {/* The dock. Bottom-right, above the mobile admin bar's own height so
          the two never sit on top of each other. */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Close Mia" : "Ask Mia"}
        className={cn(
          "focus-ring tap fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center",
          "rounded-full shadow-primary transition-colors md:bottom-6 md:right-6",
          open
            ? "bg-secondary text-primary"
            : "bg-primary text-primary-foreground hover:bg-brand-ink-deep",
        )}
      >
        {open ? (
          <X className="h-5 w-5" aria-hidden />
        ) : (
          <MessageCircle className="h-5 w-5" aria-hidden />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.aside
            aria-label="Mia"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            transition={transitions.normal}
            className={cn(
              "surface fixed bottom-36 right-4 z-40 flex max-h-[70vh] w-[calc(100vw-2rem)]",
              "max-w-[420px] flex-col overflow-hidden md:bottom-24 md:right-6",
            )}
          >
            <header className="flex items-center gap-2.5 border-b border-border p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/12 text-accent">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Mia</p>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Reads this newsroom, and nothing else. She cannot change anything.
                </p>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {!result && !asking && (
                <div>
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    Ask about what is in the newsroom — what is due, what is open, how the
                    deployment is doing. She answers from the records, or says she cannot see it.
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {prompts.map((prompt) => (
                      <li key={prompt}>
                        <button
                          type="button"
                          onClick={() => {
                            setQuestion(prompt);
                            void ask(prompt);
                          }}
                          className="focus-ring w-full rounded-md bg-secondary/70 px-3 py-2 text-left text-[13px] leading-snug text-primary transition-colors hover:bg-secondary"
                        >
                          {prompt}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {asking && (
                <p className="text-[13px] text-muted-foreground">Reading the newsroom…</p>
              )}

              {result && !asking && <Result result={result} />}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void ask(question);
              }}
              className="flex items-center gap-2 border-t border-border p-3"
            >
              <label className="sr-only" htmlFor="mia-question">
                Ask Mia
              </label>
              <input
                id="mia-question"
                ref={inputRef}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask about the newsroom"
                className="focus-ring h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
              />
              <Button size="sm" type="submit" disabled={asking || !question.trim()}>
                <Send className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * The answer, and underneath it what she was reading.
 *
 * The sources are not decoration and not a disclaimer. They are the reason a
 * short answer can be trusted at all: "deadlines" in the list means the figure
 * came from the deadlines table a second ago, and its absence means she was
 * answering without it.
 */
function Result({ result }: { result: Answer }) {
  return (
    <div className="space-y-3">
      {result.answer && (
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
          {result.answer}
        </p>
      )}

      {result.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/[0.06] p-3 text-[13px] leading-relaxed text-muted-foreground">
          {result.error}
        </p>
      )}

      {/* The facts, shown when the sentence could not be produced. Most of
          what gets asked here is answerable by reading these. */}
      {result.briefing && result.briefing.length > 0 && (
        <ul className="space-y-1.5 rounded-md bg-secondary/60 p-3">
          {result.briefing.map((line, index) => (
            <li key={index} className="text-[12px] leading-snug text-muted-foreground">
              {line}
            </li>
          ))}
        </ul>
      )}

      {result.used && result.used.length > 0 && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Read: {result.used.join(", ")}
          {result.failures && result.failures.length > 0
            ? ` · could not read: ${result.failures.join(", ")}`
            : ""}
        </p>
      )}
    </div>
  );
}
