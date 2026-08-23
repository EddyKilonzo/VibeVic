"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Lightbulb, Plus, Trash2 } from "lucide-react";
import type { Genre, Story } from "@/data/types";
import { DEFAULT_BEAT, GENRES, genreLabel } from "@/data/content";
import { allBeats } from "@/lib/beats";
import { writeDraft } from "@/lib/drafts";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import { stagger, transitions } from "@/lib/motion";
import { notify } from "@/lib/toast";
import { insert, remove, update, useNewsroom } from "@/data/newsroom/useNewsroom";
import type { Idea, IdeaStage } from "@/data/newsroom/types";
import { Reveal } from "@/components/motion";
import { BeatOptions } from "@/components/admin/BeatOptions";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";

/**
 * The story list before there are any stories.
 *
 * ── Why this screen was the one most worth building ──────────────────────
 * `data/newsroom` has modelled ideas since the workspace was designed —
 * stage, priority, the beat it would be filed under, the story it became —
 * and nothing in the product had ever read or written one. A journalist's
 * ideas were therefore the only part of the job with nowhere to go but a
 * notes app, which is exactly the scatter the newsroom model exists to stop.
 *
 * ── Priority is typed, never computed ────────────────────────────────────
 * The model's comment is explicit and this screen honours it: there is no
 * score, no ranking suggestion and no "trending" anything. Software that
 * ranked a journalist's ideas would be claiming to know which story matters,
 * and it does not.
 *
 * ── Privacy ──────────────────────────────────────────────────────────────
 * `ideas` is in `PRIVATE_COLLECTIONS`, so nothing here can reach a public
 * payload even by accident — `toPublicPayload` drops the collection whole
 * rather than filtering it field by field.
 */

const STAGES: { id: IdeaStage; label: string; hint: string }[] = [
  { id: "spark", label: "Spark", hint: "Noted, nothing done yet" },
  { id: "researching", label: "Researching", hint: "Being looked into" },
  { id: "pitched", label: "Pitched", hint: "Sent to an editor" },
  { id: "commissioned", label: "Commissioned", hint: "Going ahead" },
  { id: "dropped", label: "Dropped", hint: "Kept, so it is not raised twice" },
];

const PRIORITIES: Idea["priority"][] = ["high", "medium", "low"];

/**
 * Priority styling.
 *
 * Separated by fill weight rather than by hue alone, matching the status
 * pills on the story list: solid, tinted-and-outlined, flat grey. That
 * ordering survives greyscale and every colour-vision type, which three
 * coloured dots would not.
 */
const PRIORITY_STYLE: Record<Idea["priority"], string> = {
  high: "bg-primary text-primary-foreground",
  medium: "bg-accent/12 text-primary ring-1 ring-inset ring-accent/35",
  low: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
};

const PRIORITY_RANK: Record<Idea["priority"], number> = { high: 0, medium: 1, low: 2 };

export default function AdminIdeas() {
  const { ideas } = useNewsroom();
  const [stage, setStage] = useState<IdeaStage | "all">("all");
  const reduced = useReducedMotion();
  const router = useRouter();

  const visible = useMemo(() => {
    const list = stage === "all" ? ideas : ideas.filter((i) => i.stage === stage);
    // The journalist's own ranking first, then recency. Nothing else is
    // weighed in — see the note at the top of the file.
    return [...list].sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        b.createdAt.localeCompare(a.createdAt),
    );
  }, [ideas, stage]);

  const counts = useMemo(() => {
    const map = new Map<IdeaStage, number>();
    for (const idea of ideas) map.set(idea.stage, (map.get(idea.stage) ?? 0) + 1);
    return map;
  }, [ideas]);

  const drop = (idea: Idea) => {
    remove("ideas", idea.id);
    // Restored verbatim, id and creation date included — the list is ordered
    // by those, so undo puts the row back where it was rather than at the top
    // wearing a fresh timestamp.
    notify.undo(`Idea deleted: ${idea.title}`, () => insert("ideas", { ...idea }));
  };

  /**
   * Turns an idea into a draft.
   *
   * The note becomes the draft's opening paragraph because it is already the
   * journalist's own writing — carrying it across moves their words rather
   * than generating any. Nothing else is filled in: no rewritten headline, no
   * standfirst, no invented angle.
   */
  const startDraft = (idea: Idea) => {
    const storyId = `idea_${idea.id}`;
    const today = new Date().toISOString().slice(0, 10);
    const draft: Story = {
      id: storyId,
      slug: "",
      title: idea.title,
      dek: "",
      genre: idea.genre,
      tags: idea.tags,
      status: "draft",
      publishedAt: today,
      updatedAt: today,
      readingMinutes: 1,
      body: [{ id: `${storyId}_b1`, type: "paragraph", text: idea.note }],
    };

    try {
      writeDraft(draft);
    } catch {
      notify.error("This browser refused to save the draft", "Storage is full or blocked.");
      return;
    }

    // The idea is kept and linked rather than consumed. Where a story came
    // from is worth knowing later, and deleting the idea would throw away the
    // stage history that says how it got here.
    update("ideas", idea.id, { storyId, stage: "commissioned" }, idea.updatedAt);
    router.push(`/admin/stories/${storyId}`);
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <Reveal variant="fade-up">
        <p className="rule-label">Newsroom</p>
        <h1 className="font-display display-2 mt-2 font-semibold">Ideas</h1>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          Everything that might become a story, and the stage it has reached. Private by
          design — ideas never appear in a public payload, and like the rest of the
          workspace they are held in this browser until the API lands.
        </p>
      </Reveal>

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 lg:order-1">
          {/* Stage filter. Counts read from the list, so a stage holding
              nothing says nothing rather than showing a zero. */}
          <Reveal
            variant="fade-up"
            delay={40}
            className="surface-compact flex flex-wrap items-center gap-1 p-1"
          >
            {(["all", ...STAGES.map((s) => s.id)] as const).map((value) => {
              const meta = STAGES.find((s) => s.id === value);
              const count = value === "all" ? ideas.length : (counts.get(value) ?? 0);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStage(value)}
                  aria-pressed={stage === value}
                  title={meta?.hint}
                  className={cn(
                    "focus-ring tap relative inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors duration-normal",
                    stage === value
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-primary",
                  )}
                >
                  {stage === value && (
                    <motion.span
                      layoutId={reduced ? undefined : "admin-idea-stage-pill"}
                      className="absolute inset-0 rounded-md bg-primary"
                      transition={transitions.normal}
                    />
                  )}
                  <span className="relative">{meta?.label ?? "All"}</span>
                  {count > 0 && <span className="relative tabular-nums opacity-70">{count}</span>}
                </button>
              );
            })}
          </Reveal>

          <div className="surface mt-5 overflow-hidden">
            {visible.length === 0 ? (
              <EmptyState
                icon={<Lightbulb className="h-5 w-5" aria-hidden />}
                title={ideas.length === 0 ? "No ideas yet" : "Nothing at this stage"}
                description={
                  ideas.length === 0
                    ? "Write the next one down before it goes. A line is enough — the beat, the note and the priority can follow."
                    : "Every idea you have is at another stage. Switch the filter to see them."
                }
                className="border-0"
              />
            ) : (
              <ul className="divide-y divide-border">
                <AnimatePresence initial={false}>
                  {visible.map((idea, i) => (
                    <motion.li
                      key={idea.id}
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
                      className="group relative overflow-hidden"
                    >
                      <div className="p-4 transition-colors duration-normal hover:bg-secondary/50">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold leading-snug tracking-tight">
                              {idea.title}
                            </p>
                            {idea.note && (
                              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                                {idea.note}
                              </p>
                            )}
                            <p className="mt-1.5 text-xs text-muted-foreground">
                              {genreLabel(idea.genre)} · added {formatRelative(idea.createdAt)}
                            </p>
                          </div>

                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
                              PRIORITY_STYLE[idea.priority],
                            )}
                          >
                            {idea.priority}
                          </span>

                          <button
                            type="button"
                            onClick={() => drop(idea)}
                            aria-label={`Delete ${idea.title}`}
                            className="focus-ring tap-square flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all duration-normal hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          {/* The stage is the field that changes most, so it
                              is editable in place rather than behind a detail
                              view. The concurrency check is opted out of here
                              deliberately: replacing one enum with another
                              cannot lose anything a second tab typed. */}
                          <label className="flex items-center gap-2 text-xs">
                            <span className="rule-label">Stage</span>
                            <select
                              value={idea.stage}
                              onChange={(e) =>
                                update("ideas", idea.id, { stage: e.target.value as IdeaStage })
                              }
                              aria-label={`Stage of ${idea.title}`}
                              className="focus-ring tap rounded-md border border-border bg-background px-2 py-1 text-xs"
                            >
                              {STAGES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          {idea.storyId ? (
                            <Link
                              href={`/admin/stories/${idea.storyId}`}
                              className="focus-ring underline-grow inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
                            >
                              Open the draft
                              <ArrowRight className="nudge-x h-3.5 w-3.5" aria-hidden />
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startDraft(idea)}
                              className="focus-ring tap inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground transition-colors duration-normal hover:bg-secondary hover:text-primary"
                            >
                              Start a draft
                              <ArrowRight className="nudge-x h-3.5 w-3.5" aria-hidden />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </div>

        <IdeaForm />
      </div>
    </div>
  );
}

/**
 * The capture form.
 *
 * The title is the only required field. An idea that costs a form to record
 * is an idea that goes unrecorded — the beat, the priority and the note can
 * all be changed afterwards, and the starting stage is the honest one.
 */
function IdeaForm() {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [genre, setGenre] = useState(DEFAULT_BEAT);
  const [priority, setPriority] = useState<Idea["priority"]>("medium");
  const [beats, setBeats] = useState<Genre[]>(GENRES);
  const reduced = useReducedMotion();

  /**
   * Ref callback rather than an effect: the route is prerendered, and reading
   * storage during the first client pass would disagree with the HTML being
   * hydrated.
   *
   * ── Why it is wrapped, and why the guard is not optional ─────────────────
   * This was a bare arrow function, and it took the whole screen down with
   * "Maximum update depth exceeded". A ref callback is re-attached whenever
   * its identity changes, and an inline arrow has a new identity on every
   * render — so React called it again after each paint, it called `setBeats`,
   * and `allBeats()` returns a freshly built array every time, so the state
   * was always a new reference and always scheduled another render. An
   * infinite loop with no growing value in it, which is why nothing about the
   * screen hinted at the cause.
   *
   * `useCallback` stops the re-attachment. The comparison stops the render
   * even in the case where something else does re-attach it: same beats, same
   * array, no update.
   */
  const load = useCallback((node: HTMLFormElement | null) => {
    if (!node) return;
    setBeats((current) => {
      const next = allBeats();
      const same =
        current.length === next.length && current.every((beat, i) => beat.slug === next[i].slug);
      return same ? current : next;
    });
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    insert("ideas", {
      title: trimmed,
      note: note.trim(),
      tags: [],
      genre,
      priority,
      stage: "spark",
    });

    setTitle("");
    setNote("");
    notify.success("Idea noted", "Private to this workspace.");
  };

  return (
    <Reveal
      variant="fade-up"
      delay={120}
      className="surface honeycomb honeycomb-strong h-fit overflow-hidden p-5 sm:p-6 lg:order-2 lg:sticky lg:top-24"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
        <Lightbulb className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <h2 className="font-display mt-4 text-lg font-semibold tracking-tight">Note an idea</h2>

      <form ref={load} onSubmit={submit} className="mt-5">
        <label htmlFor="idea-title" className="rule-label">
          The idea
        </label>
        <input
          id="idea-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="One line is enough"
          className="focus-ring mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-accent"
        />

        <label htmlFor="idea-note" className="rule-label mt-5 block">
          What you know so far
        </label>
        <textarea
          id="idea-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="Who to call, what to check, why now."
          className="focus-ring mt-2 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />

        <label htmlFor="idea-beat" className="rule-label mt-5 block">
          Beat
        </label>
        <select
          id="idea-beat"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="focus-ring mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-accent"
        >
          <BeatOptions beats={beats} />
        </select>

        <p className="rule-label mt-5">Priority</p>
        <div
          role="group"
          aria-label="Priority"
          className="surface-compact mt-2 flex items-center gap-1 p-1"
        >
          {PRIORITIES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPriority(value)}
              aria-pressed={priority === value}
              className={cn(
                "focus-ring relative inline-flex h-8 flex-1 items-center justify-center rounded-md text-xs font-semibold capitalize transition-colors duration-normal",
                priority === value
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-primary",
              )}
            >
              {priority === value && (
                <motion.span
                  layoutId={reduced ? undefined : "admin-idea-priority-pill"}
                  className="absolute inset-0 rounded-md bg-primary"
                  transition={transitions.normal}
                />
              )}
              <span className="relative">{value}</span>
            </button>
          ))}
        </div>

        <Button type="submit" className="mt-5 w-full" disabled={!title.trim()}>
          <Plus className="icon-pop h-4 w-4" aria-hidden />
          Note it
        </Button>
      </form>

      <p className="mt-6 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
        Priority is yours to set and is never calculated. Nothing on this screen ranks your
        ideas for you.
      </p>
    </Reveal>
  );
}
