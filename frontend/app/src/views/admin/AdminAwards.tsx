"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Plus, ShieldAlert, Trash2, Trophy } from "lucide-react";
import type { Award } from "@/data/types";
import { AWARDS } from "@/data/content";
import { cn } from "@/lib/utils";
import { stagger, transitions } from "@/lib/motion";
import { notify } from "@/lib/toast";
import {
  addAward,
  listAwards,
  removeAward,
  restoreAward,
  RESULTS,
  type RecordedAward,
} from "@/lib/awards";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";

/**
 * Awards.
 *
 * ── The one screen in the admin that can do real harm ────────────────────
 * Everything else here records work that exists: a draft is a draft whether
 * or not anyone believes in it. An award is a *claim about the world*, made
 * on a real journalist's behalf, and a wrong one is a fabricated credential —
 * the single worst thing this product could publish. `data/content` ships
 * `AWARDS` empty for exactly that reason, and the public page says so.
 *
 * So this screen is built to make the claim deliberate:
 *
 *  - Nothing is pre-filled. No result is selected until it is chosen, no list
 *    of plausible awarding bodies is offered, and there is no autocomplete —
 *    a suggestion is a nudge towards a credential nobody typed.
 *  - The awarding body is required, because a prize with nobody behind it
 *    cannot be checked, and an unverifiable credential is worse than none.
 *  - The warning sits above the form rather than under it.
 *
 * ── Where entries go ─────────────────────────────────────────────────────
 * This browser, like the rest of the workspace. The published list is
 * compiled into the site, so an entry recorded here reaches the public page
 * when the API lands and a build follows — the screen says that rather than
 * implying the site has changed.
 */
export default function AdminAwards() {
  const [recorded, setRecorded] = useState<RecordedAward[]>([]);
  const reduced = useReducedMotion();

  // Ref callback, not an effect: this route is prerendered, so reading storage
  // during the first client pass would disagree with the HTML being hydrated.
  const load = useCallback((node: HTMLDivElement | null) => {
    if (node) setRecorded(listAwards());
  }, []);

  const drop = (award: RecordedAward) => {
    removeAward(award.id);
    setRecorded((list) => list.filter((a) => a.id !== award.id));
    notify.undo(`Removed: ${award.title}`, () => {
      restoreAward(award);
      setRecorded(listAwards());
    });
  };

  return (
    <div ref={load} className="mx-auto max-w-[1100px]">
      <Reveal variant="fade-up">
        <p className="rule-label">Recognition</p>
        <h1 className="font-display display-2 mt-2 font-semibold">Awards</h1>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          Prizes, nominations and shortlistings, recorded as they happen. The public awards
          page lists what is compiled into the site; an entry made here is held in this
          browser until the API lands.
        </p>
      </Reveal>

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5 lg:order-1">
          {/* ── On the public site ──────────────────────────────── */}
          <Reveal variant="fade-up" delay={60} className="surface p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="rule-label">On the public site</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Compiled into the build. Editing these means editing the source.
                </p>
              </div>
              <Link
                href="/awards"
                className="focus-ring underline-grow shrink-0 text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                View the page
              </Link>
            </div>

            {AWARDS.length === 0 ? (
              <p className="mt-5 rounded-lg border border-dashed border-border p-4 text-sm leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Nothing is listed.</span> The
                awards page renders an honest empty state, and it will keep doing so until real
                entries are added to the source. Nothing has ever been invented for it.
              </p>
            ) : (
              <ul className="mt-5 divide-y divide-border">
                {AWARDS.map((award) => (
                  <li key={`${award.year}-${award.title}`} className="py-3 first:pt-0">
                    <AwardLine award={award} />
                  </li>
                ))}
              </ul>
            )}
          </Reveal>

          {/* ── Recorded here ───────────────────────────────────── */}
          <Reveal variant="fade-up" delay={90} className="surface overflow-hidden">
            <div className="p-5 pb-4 sm:px-6">
              <p className="rule-label">Recorded here</p>
              <p className="mt-1 text-sm text-muted-foreground">
                On this device only. Not on the site yet.
              </p>
            </div>

            {recorded.length === 0 ? (
              <EmptyState
                icon={<Trophy className="h-5 w-5" aria-hidden />}
                title="No entries recorded"
                description="When something is won, shortlisted or nominated, record it here with the body that gave it and the year."
                className="border-0"
              />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                <AnimatePresence initial={false}>
                  {recorded.map((award, i) => (
                    <motion.li
                      key={award.id}
                      layout={!reduced}
                      initial={reduced ? false : { opacity: 0, y: 8 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        transition: {
                          ...transitions.normal,
                          delay: Math.min(i, 8) * stagger.tight,
                        },
                      }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0, x: -12, height: 0 }}
                      transition={transitions.normal}
                      className="group flex items-start gap-4 p-4 transition-colors duration-normal hover:bg-secondary/50 sm:px-6"
                    >
                      <div className="min-w-0 flex-1">
                        <AwardLine award={award} />
                      </div>
                      <button
                        type="button"
                        onClick={() => drop(award)}
                        aria-label={`Remove ${award.title}`}
                        className="focus-ring tap-square flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all duration-normal hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </Reveal>
        </div>

        <AwardForm onAdded={() => setRecorded(listAwards())} />
      </div>
    </div>
  );
}

/** Year, result and title on one line — the shape the public timeline uses. */
function AwardLine({ award }: { award: Award }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-2.5">
        <span className="font-display text-base font-semibold tabular-nums text-primary">
          {award.year}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]",
            // Solid for a win, outlined for everything else. The distinction
            // survives greyscale, which colour alone would not.
            award.result === "Winner"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
          )}
        >
          {award.result}
        </span>
      </div>
      <p className="mt-1.5 font-semibold leading-snug tracking-tight">{award.title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{award.body}</p>
      {award.description && (
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {award.description}
        </p>
      )}
    </>
  );
}

/**
 * The entry form.
 *
 * `result` starts unselected. A default of "Winner" would be one careless
 * submit away from a prize nobody won, and a default of "Finalist" would be
 * the same mistake wearing a quieter coat.
 */
function AwardForm({ onAdded }: { onAdded: () => void }) {
  const [year, setYear] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<Award["result"] | "">("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!result) {
      setError("Choose what the result actually was.");
      return;
    }

    const outcome = addAward({ year, title, body, description, result });
    if (!outcome.ok) {
      setError(outcome.reason);
      return;
    }

    setYear("");
    setTitle("");
    setBody("");
    setDescription("");
    setResult("");
    setError(null);
    onAdded();
    notify.success("Award recorded", "On this device — the public page is unchanged.");
  };

  return (
    <Reveal
      variant="fade-up"
      delay={120}
      className="h-fit space-y-4 lg:order-2 lg:sticky lg:top-24"
    >
      {/* Above the form, not below it. */}
      <div className="flex gap-3 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">This is a credential.</span> Record
          only what was actually awarded, by the body that awarded it. Nothing on this screen
          suggests, completes or infers an entry.
        </p>
      </div>

      <form onSubmit={submit} className="surface honeycomb honeycomb-strong overflow-hidden p-5 sm:p-6">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
          <Trophy className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <h2 className="font-display mt-4 text-lg font-semibold tracking-tight">
          Record an award
        </h2>

        <label htmlFor="award-title" className="rule-label mt-5 block">
          What it is called
        </label>
        <input
          id="award-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          placeholder="The award, as it is named"
          className="focus-ring mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-accent"
        />

        <label htmlFor="award-body" className="rule-label mt-5 block">
          Who gave it
        </label>
        <input
          id="award-body"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setError(null);
          }}
          placeholder="The awarding body"
          className="focus-ring mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-accent"
        />

        <label htmlFor="award-year" className="rule-label mt-5 block">
          Year
        </label>
        <input
          id="award-year"
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            setError(null);
          }}
          inputMode="numeric"
          maxLength={4}
          placeholder="2026"
          className="focus-ring mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm tabular-nums outline-none transition-colors focus:border-accent"
        />

        <p className="rule-label mt-5">Result</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {RESULTS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setResult(value);
                setError(null);
              }}
              aria-pressed={result === value}
              className={cn(
                "focus-ring inline-flex h-10 items-center justify-center rounded-md px-2 text-xs font-semibold transition-colors duration-normal",
                result === value
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:border-primary hover:text-primary",
              )}
            >
              {value}
            </button>
          ))}
        </div>

        <label htmlFor="award-description" className="rule-label mt-5 block">
          What it was for
        </label>
        <textarea
          id="award-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="The work it recognised. Optional, and shown on the public page."
          className="focus-ring mt-2 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />

        {error && (
          <p role="alert" className="mt-3 text-sm leading-snug text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="mt-5 w-full" disabled={!title.trim() || !body.trim()}>
          <Plus className="icon-pop h-4 w-4" aria-hidden />
          Record it
        </Button>

        <p className="mt-6 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
          Recording an entry does not change the public page. It reaches the site when the API
          lands and a build follows.
        </p>
      </form>
    </Reveal>
  );
}
