"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Lightbulb, Plus, Trash2 } from "lucide-react";
import type { Genre } from "@/data/types";
import { DEFAULT_BEAT } from "@/data/content";
import { useTaxonomy } from "@/context/TaxonomyProvider";
import { allBeats } from "@/lib/beats";
import { createStory } from "@/lib/story-save";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import { stagger, transitions } from "@/lib/motion";
import { notify } from "@/lib/toast";
import { insert, remove, update, useNewsroom } from "@/data/newsroom/useNewsroom";
import type { Idea, IdeaStage } from "@/data/newsroom/types";
import { Reveal } from "@/components/motion";
import { BeatOptions } from "@/components/admin/BeatOptions";
import { PitchDesk } from "@/components/admin/PitchDesk";
import { PitchPanel } from "@/components/admin/PitchPanel";
import type { PitchResult } from "@/components/admin/pitch";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { newsroomPath } from "@/lib/newsroom-path";

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
  const { genreLabel } = useTaxonomy();
  const {
    newsroom: { ideas },
    loading,
    error,
  } = useNewsroom("ideas");
  const [stage, setStage] = useState<IdeaStage | "all">("all");

  /**
   * The worked-up idea, and the two form fields it can write into.
   *
   * Held here rather than in the form because the panel renders in the other
   * column — under the ideas list, where there is width to read three angles
   * and two lists without them becoming a column of fragments. The note and
   * the beat live up here for the same reason: they are what "Add to the
   * note" and "File under" reach for, and a panel in one column cannot set
   * state that only exists in another.
   */
  const [pitch, setPitch] = useState<PitchResult | null>(null);
  const [note, setNote] = useState("");
  const [genre, setGenre] = useState(DEFAULT_BEAT);
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

  /**
   * Delete, with an undo that re-notes rather than resurrects.
   *
   * The local store could put the row back verbatim, id and creation date
   * included, because it was the only thing that knew them. Against a server
   * the id and the timestamps belong to the database and a create cannot claim
   * them, so undo writes the idea again as a new record — same title, note,
   * tags, beat, priority and stage, new id, new creation date.
   *
   * The difference is visible in exactly one place: the list is ordered by
   * priority and then by creation date, so an undone idea comes back at the top
   * of its priority band rather than where it was. That is a smaller lie than
   * a button labelled undo that quietly fails, which is the alternative.
   */
  const drop = async (idea: Idea) => {
    const result = await remove("ideas", idea.id);
    if (!result.ok) {
      notify.error("The idea was not deleted", result.message);
      return;
    }

    notify.undo(`Idea deleted: ${idea.title}`, () => {
      void insert("ideas", {
        title: idea.title,
        note: idea.note,
        tags: idea.tags,
        genre: idea.genre,
        priority: idea.priority,
        stage: idea.stage,
        storyId: idea.storyId,
      }).then((restored) => {
        if (!restored.ok) notify.error("The idea could not be restored", restored.message);
      });
    });
  };

  /**
   * Turns an idea into a draft.
   *
   * The note becomes the draft's opening paragraph because it is already the
   * journalist's own writing — carrying it across moves their words rather
   * than generating any. Nothing else is filled in: no rewritten headline, no
   * standfirst, no invented angle.
   *
   * ── Why this files a real record rather than a local draft ───────────────
   * It used to invent an id — `idea_<ideaId>` — write the story to
   * `localStorage` under it, link the idea to that id and navigate there. Every
   * step worked, and the result was still wrong once stories moved to Postgres:
   * the id named no row, so `Open the draft` led to a blank editor on any other
   * machine, and the first save in the workspace created a *second* record with
   * a real id that the idea did not know about. One idea, two drafts, and the
   * link pointing at the one that only existed in one browser.
   *
   * Creating the record here means the id in `storyId` is the id in the
   * database. The workspace then opens it the ordinary way, from the API.
   */
  const [starting, setStarting] = useState<string | null>(null);

  const startDraft = async (idea: Idea) => {
    if (starting) return;
    setStarting(idea.id);

    const today = new Date().toISOString().slice(0, 10);
    const created = await createStory({
      // `id` and `updatedAt` are the server's to decide; the proxy strips what
      // it does not model and derives the slug from the title, once.
      id: "new",
      slug: "",
      title: idea.title,
      dek: "",
      genre: idea.genre,
      tags: idea.tags,
      status: "draft",
      publishedAt: today,
      updatedAt: today,
      readingMinutes: 1,
      body: [{ id: `b${Date.now()}`, type: "paragraph", text: idea.note }],
    });

    if (!created.ok) {
      setStarting(null);
      // Nothing is navigated to and nothing is linked. Seeding a local draft
      // and going anyway is what produced the orphan above: it would leave the
      // journalist writing into a story the newsroom has no record of, with an
      // idea still saying "spark" beside it. One more press is the cheaper
      // failure, and the idea is untouched either way.
      notify.error("The draft was not started", created.message);
      return;
    }

    const storyId = created.story.id;

    // The idea is kept and linked rather than consumed. Where a story came
    // from is worth knowing later, and deleting the idea would throw away the
    // stage history that says how it got here.
    //
    // The link is written before navigating. The story exists by this point, so
    // a failure here costs the connection between the two rather than the work
    // — but leaving without knowing would strand an idea that says "spark"
    // next to a draft that exists.
    const linked = await update(
      "ideas",
      idea.id,
      { storyId, stage: "commissioned" },
      idea.updatedAt,
    );
    if (!linked.ok) {
      notify.error(
        "The draft was filed, but the idea was not updated",
        linked.reason === "conflict"
          ? "The idea changed in another tab. Open it again and link the draft by hand."
          : linked.message,
      );
    }

    setStarting(null);
    router.push(newsroomPath(`/stories/${storyId}`));
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <Reveal variant="fade-up">
        <p className="rule-label">Newsroom</p>
        <h1 className="font-display display-2 mt-2 font-semibold">Ideas</h1>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          Everything that might become a story, and the stage it has reached. Private by
          design — ideas never appear in a public payload, and like the rest of the
          workspace they are kept in the newsroom, not in this browser.
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
            {/* Three empty-looking states that mean different things, and are
                said differently. "No ideas yet" is an invitation; a list that
                has not arrived is not empty, it is unknown; and a list that
                failed to arrive is a fact about the newsroom, not about how
                many ideas the journalist has had. Rounding the last two to the
                first would tell someone their ideas are gone. */}
            {error ? (
              <EmptyState
                icon={<Lightbulb className="h-5 w-5" aria-hidden />}
                title="The ideas could not be loaded"
                description={error}
                className="border-0"
              />
            ) : loading && ideas.length === 0 ? (
              <EmptyState
                icon={<Lightbulb className="h-5 w-5" aria-hidden />}
                title="Loading your ideas"
                description="Reading them from the newsroom."
                className="border-0"
              />
            ) : visible.length === 0 ? (
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
                              view. No `expectedUpdatedAt` is passed, which now
                              means "use the copy we hold" rather than "skip the
                              check" — the API has no opt out. That is stricter
                              than before and right: if another tab moved this
                              idea on, saying so beats overwriting it. */}
                          <label className="flex items-center gap-2 text-xs">
                            <span className="rule-label">Stage</span>
                            <select
                              value={idea.stage}
                              onChange={(e) => {
                                const next = e.target.value as IdeaStage;
                                void update("ideas", idea.id, { stage: next }).then((result) => {
                                  if (!result.ok) {
                                    notify.error(
                                      "The stage was not changed",
                                      result.reason === "conflict"
                                        ? "This idea changed in another tab. The list has been refreshed."
                                        : result.message,
                                    );
                                  }
                                });
                              }}
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
                              href={newsroomPath(`/stories/${idea.storyId}`)}
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

          {pitch && (
            <PitchPanel
              result={pitch}
              onUseAngle={(text) => setNote((current) => (current ? `${current}

${text}` : text))}
              onUseBeat={setGenre}
              onDismiss={() => setPitch(null)}
            />
          )}
        </div>

        <IdeaForm
          note={note}
          setNote={setNote}
          genre={genre}
          setGenre={setGenre}
          onResult={setPitch}
        />
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
function IdeaForm({
  note,
  setNote,
  genre,
  setGenre,
  onResult,
}: {
  note: string;
  setNote: React.Dispatch<React.SetStateAction<string>>;
  genre: string;
  setGenre: (slug: string) => void;
  onResult: (result: PitchResult) => void;
}) {
  const { genres } = useTaxonomy();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Idea["priority"]>("medium");
  const [beats, setBeats] = useState<Genre[]>(genres);
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
      const next = allBeats(genres);
      const same =
        current.length === next.length && current.every((beat, i) => beat.slug === next[i].slug);
      return same ? current : next;
    });
    // `genres` is a dependency now that the published beats are fetched: a
    // callback pinned to the empty first-render list would leave the picker
    // showing only locally-added beats. The comparison above still stops the
    // re-render when the list has not actually changed.
  }, [genres]);

  /**
   * The fields are cleared only once the idea is actually saved.
   *
   * Clearing them optimistically reads better and is wrong: a failed write
   * would leave the journalist looking at an empty form and a toast, with the
   * sentence they typed gone. Keeping the text until the server has it means a
   * failure costs a second press rather than the idea.
   */
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    const result = await insert("ideas", {
      title: trimmed,
      note: note.trim(),
      tags: [],
      genre,
      priority,
      stage: "spark",
    });
    setSaving(false);

    if (!result.ok) {
      notify.error("The idea was not saved", result.message);
      return;
    }

    setTitle("");
    setNote("");
    notify.success("Idea noted", "Private to the newsroom.");
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
          <BeatOptions beats={beats} published={genres} />
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

        {/* Below the submit, not above it: noting the idea is the thing this
            form is for, and a machine should not be standing between a
            journalist and writing their own line down. Every suggestion it
            makes takes a deliberate click to enter the note or the beat. */}
        <PitchDesk idea={title} note={note} onResult={onResult} />
      </form>

      <p className="mt-6 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
        Priority is yours to set and is never calculated. Nothing on this screen ranks your
        ideas for you.
      </p>
    </Reveal>
  );
}
