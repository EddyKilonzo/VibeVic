"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Plus, ShieldAlert, Trash2, Trophy } from "lucide-react";
import type { Award } from "@/data/types";
import { cn } from "@/lib/utils";
import { stagger, transitions } from "@/lib/motion";
import { notify } from "@/lib/toast";
import {
  addAward,
  listAwards,
  removeAward,
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
 * The newsroom, and therefore the public page. This screen used to keep two
 * lists side by side — "on the public site", read from the API, and "recorded
 * here", held in this browser — because there was no way to write an award and
 * the honest thing was to say so. There is now, and they are one list: the
 * table this writes to is the table `/awards` reads.
 *
 * The split is gone rather than kept as decoration. Two panels over one source
 * would imply a staging step that does not exist, and the whole reason the old
 * screen was built that way was to avoid implying one that did not.
 */
export default function AdminAwards() {
  const [awards, setAwards] = useState<RecordedAward[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [problem, setProblem] = useState<string | null>(null);
  const reduced = useReducedMotion();

  const refresh = useCallback(async () => {
    const result = await listAwards();
    if (!result.ok) {
      setStatus("error");
      setProblem(result.message);
      return;
    }
    setAwards(result.value);
    setProblem(null);
    setStatus("ready");
  }, []);

  /**
   * Loaded from a ref callback rather than an effect.
   *
   * The pattern the rest of this admin uses, and for the same two reasons: the
   * route is prerendered, so the first client pass must not disagree with the
   * HTML being hydrated, and setting state straight out of an effect body is
   * the cascading-render shape the linter rightly objects to. The callback
   * fires once the panel is actually on the page.
   */
  const load = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) void refresh();
    },
    [refresh],
  );

  /**
   * Delete, with an undo that re-records rather than resurrects.
   *
   * The local store could put the row back verbatim, id and creation date
   * included, because it was the only thing that knew them. Against a server
   * they belong to the database and a create cannot claim them, so undo writes
   * the award again as a new record — same year, title, body, description and
   * result, new id. The same trade `AdminIdeas` makes, and for the same reason:
   * a smaller lie than a button labelled undo that quietly fails.
   */
  const drop = async (award: RecordedAward) => {
    const result = await removeAward(award.id);
    if (!result.ok) {
      notify.error("The award was not removed", result.message);
      return;
    }

    setAwards((list) => list.filter((a) => a.id !== award.id));

    notify.undo(`Removed: ${award.title}`, () => {
      void addAward(award).then((restored) => {
        if (!restored.ok) {
          notify.error("The award could not be restored", restored.message);
          return;
        }
        void refresh();
      });
    });
  };

  return (
    <div ref={load} className="mx-auto max-w-[1100px]">
      <Reveal variant="fade-up">
        <p className="rule-label">Recognition</p>
        <h1 className="font-display desk-title mt-2 font-semibold">Awards</h1>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          Prizes, nominations and shortlistings, recorded as they happen. This is the
          list the public awards page reads — an entry made here is on the site.
        </p>
      </Reveal>

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5 lg:order-1">
          <Reveal variant="fade-up" delay={60} className="surface overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-3 p-5 pb-4 sm:px-6">
              <div>
                <p className="rule-label">Recorded</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  These are what the public awards page lists.
                </p>
              </div>
              <Link
                href="/awards"
                className="focus-ring underline-grow shrink-0 text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                View the page
              </Link>
            </div>

            {/* Three empty-looking states that mean different things, and are
                said differently. A list that has not arrived is not empty, it
                is unknown; a list that failed to arrive is a fact about the
                newsroom rather than about the journalist's career; and no
                awards is an honest and unremarkable state to be in. Rounding
                the first two to the third would tell somebody their record is
                gone. */}
            {status === "error" ? (
              <EmptyState
                icon={<Trophy className="h-5 w-5" aria-hidden />}
                title="The awards could not be loaded"
                description={problem ?? "The newsroom did not answer."}
                className="border-0"
              />
            ) : status === "loading" ? (
              <EmptyState
                icon={<Trophy className="h-5 w-5" aria-hidden />}
                title="Loading"
                description="Reading them from the newsroom."
                className="border-0"
              />
            ) : awards.length === 0 ? (
              <EmptyState
                icon={<Trophy className="h-5 w-5" aria-hidden />}
                title="No entries recorded"
                description="When something is won, shortlisted or nominated, record it here with the body that gave it and the year. The public page shows an honest empty state until then — nothing has ever been invented for it."
                className="border-0"
              />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                <AnimatePresence initial={false}>
                  {awards.map((award, i) => (
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
                        onClick={() => void drop(award)}
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

        <AwardForm onAdded={refresh} />
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
function AwardForm({ onAdded }: { onAdded: () => void | Promise<void> }) {
  const [year, setYear] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<Award["result"] | "">("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!result) {
      setError("Choose what the result actually was.");
      return;
    }

    setSaving(true);
    const outcome = await addAward({ year, title, body, description, result });
    setSaving(false);

    if (!outcome.ok) {
      // The fields keep what was typed. A failed write that also emptied the
      // form would cost the journalist the entry rather than a second press.
      setError(outcome.message);
      return;
    }

    setYear("");
    setTitle("");
    setBody("");
    setDescription("");
    setResult("");
    setError(null);
    onAdded();
    notify.success("Award recorded", "It is on the public awards page.");
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
        <span className="inline-flex h-9 w-9 items-center justify-center text-primary">
          <Trophy className="h-5 w-5" aria-hidden />
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

        <Button
          type="submit"
          className="mt-5 w-full"
          disabled={!title.trim() || !body.trim() || saving}
        >
          <Plus className="icon-pop h-4 w-4" aria-hidden />
          {saving ? "Recording…" : "Record it"}
        </Button>

        <p className="mt-6 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
          Every field is typed by the person who knows the answer. Nothing here is
          suggested, defaulted or autocompleted — an award is a credential, and a form
          that guesses one will eventually record a prize nobody won.
        </p>
      </form>
    </Reveal>
  );
}
