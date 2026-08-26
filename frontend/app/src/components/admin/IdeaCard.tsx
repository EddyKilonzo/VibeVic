"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Pencil, Trash2, X } from "lucide-react";
import type { Genre } from "@/data/types";
import type { Idea, IdeaStage } from "@/data/newsroom/types";
import { update } from "@/data/newsroom/useNewsroom";
import { useTaxonomy } from "@/context/TaxonomyProvider";
import { allBeats } from "@/lib/beats";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import { transitions } from "@/lib/motion";
import { notify } from "@/lib/toast";
import { newsroomPath } from "@/lib/newsroom-path";
import { BeatOptions } from "@/components/admin/BeatOptions";
import { Button } from "@/components/ui/Button";
import { MAX_TAGS, PRIORITIES, PRIORITY_STYLE, STAGES } from "./idea";

/**
 * A tag field: chips you can remove, and one input that commits on Enter.
 *
 * ── Why tags exist here at all ───────────────────────────────────────────
 * `Idea.tags` has been in the model since the workspace was designed, and the
 * API validates it at fifty entries — and nothing in the product had ever set
 * one. `insert` passed a hardcoded empty array. A modelled field nothing
 * writes is worse than no field: it survives every refactor, it rides in every
 * payload, and the first person to need it assumes it works.
 *
 * ── What it refuses ──────────────────────────────────────────────────────
 * Blanks, duplicates and anything past the API's ceiling. Duplicates matter
 * more than they look: the filter strip counts uses, so two copies of one word
 * on a single idea would make a filter that returns fewer rows than it counted.
 */
function TagField({
  tags,
  onChange,
  id,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
  id: string;
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    // A comma is how anybody who has met a tag field before expects to separate
    // them, so pasting "water, turkana, boreholes" does the obvious thing.
    const added = raw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    if (added.length === 0) {
      setDraft("");
      return;
    }

    const next = [...tags];
    for (const t of added) {
      if (next.length >= MAX_TAGS) break;
      if (!next.includes(t)) next.push(t);
    }
    onChange(next);
    setDraft("");
  };

  const full = tags.length >= MAX_TAGS;

  return (
    <div className="mt-2">
      {tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-secondary pl-2.5 pr-1 text-[11px] font-semibold text-muted-foreground"
            >
              {t}
              <button
                type="button"
                onClick={() => onChange(tags.filter((x) => x !== t))}
                aria-label={`Remove tag ${t}`}
                className="focus-ring flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-background hover:text-primary"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            // Enter inside a form submits it, and on the capture form that
            // would file the idea while somebody is still typing its tags.
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && !draft && tags.length > 0) {
            onChange(tags.slice(0, -1));
          }
        }}
        // Committed on blur too, because a tag typed and then clicked away from
        // has been typed. Dropping it silently is what every tag field gets
        // wrong, and the person only finds out when the filter comes up empty.
        onBlur={() => commit(draft)}
        disabled={full}
        placeholder={full ? `That is ${MAX_TAGS} tags` : "Add a tag, then Enter"}
        className="focus-ring h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-accent disabled:opacity-60"
      />
    </div>
  );
}

/**
 * The editor for one idea.
 *
 * ── Seeded once, from the row it opened on ───────────────────────────────
 * State is initialised from `idea` and then owned here, which is what lets
 * somebody type without every keystroke racing the store. The consequence is
 * that a change arriving from another tab mid-edit will not appear in these
 * fields — and that is the honest outcome rather than a bug. Overwriting what
 * a journalist is halfway through typing is worse than letting the save answer
 * 409, which it will: the `updatedAt` this was seeded with is the one sent
 * back, so a stale edit is refused rather than applied.
 */
function IdeaEditor({
  idea,
  genres,
  onDone,
}: {
  idea: Idea;
  genres: Genre[];
  onDone: () => void;
}) {
  const [title, setTitle] = useState(idea.title);
  const [note, setNote] = useState(idea.note);
  const [genre, setGenre] = useState(idea.genre);
  const [priority, setPriority] = useState<Idea["priority"]>(idea.priority);
  const [tags, setTags] = useState<string[]>(idea.tags);
  const [saving, setSaving] = useState(false);
  const reduced = useReducedMotion();

  // Safe to read storage during this render: the editor only ever mounts from
  // a click, which is long after hydration. `IdeaForm` needs a ref callback
  // because it renders in the prerendered pass; this does not.
  const beats = useMemo(() => allBeats(genres), [genres]);

  const trimmed = title.trim();
  const dirty =
    trimmed !== idea.title ||
    note.trim() !== idea.note ||
    genre !== idea.genre ||
    priority !== idea.priority ||
    tags.length !== idea.tags.length ||
    tags.some((t, i) => t !== idea.tags[i]);

  const save = async () => {
    if (!trimmed || saving) return;
    setSaving(true);

    /**
     * `idea.updatedAt` explicitly, not the cached copy.
     *
     * This is the version the fields were seeded from, so it is the only
     * timestamp that makes the conflict check mean what it says. Letting the
     * store supply its own would compare against whatever it has read since —
     * which, if another tab wrote in the meantime, is exactly the value that
     * would let this overwrite it.
     */
    const result = await update(
      "ideas",
      idea.id,
      { title: trimmed, note: note.trim(), genre, priority, tags },
      idea.updatedAt,
    );
    setSaving(false);

    if (!result.ok) {
      notify.error(
        "The idea was not saved",
        result.reason === "conflict"
          ? "This idea changed in another tab. The list has been refreshed — reopen it and reapply your edit."
          : result.message,
      );
      // Left open on purpose. Closing would throw away what was typed, which is
      // the one thing a failed save must never do.
      return;
    }

    onDone();
  };

  return (
    <div className="bg-secondary/40 p-4">
      <label htmlFor={`idea-${idea.id}-title`} className="rule-label">
        The idea
      </label>
      <input
        id={`idea-${idea.id}-title`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="focus-ring mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-semibold outline-none transition-colors focus:border-accent"
      />

      <label htmlFor={`idea-${idea.id}-note`} className="rule-label mt-4 block">
        What you know so far
      </label>
      <textarea
        id={`idea-${idea.id}-note`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="Who to call, what to check, why now."
        className="focus-ring mt-2 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
      />

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`idea-${idea.id}-beat`} className="rule-label">
            Beat
          </label>
          <select
            id={`idea-${idea.id}-beat`}
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="focus-ring mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-accent"
          >
            <BeatOptions beats={beats} published={genres} />
          </select>
        </div>

        <div>
          <p className="rule-label">Priority</p>
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
                  "focus-ring relative inline-flex h-7 flex-1 items-center justify-center rounded text-xs font-semibold capitalize transition-colors duration-normal",
                  priority === value
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-primary",
                )}
              >
                {priority === value && (
                  <motion.span
                    layoutId={reduced ? undefined : `idea-${idea.id}-priority`}
                    className="absolute inset-0 rounded bg-primary"
                    transition={transitions.normal}
                  />
                )}
                <span className="relative">{value}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <label htmlFor={`idea-${idea.id}-tags`} className="rule-label mt-4 block">
        Tags
      </label>
      <TagField id={`idea-${idea.id}-tags`} tags={tags} onChange={setTags} />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} disabled={!trimmed || !dirty || saving}>
          <Check className="icon-pop h-4 w-4" aria-hidden />
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="quiet" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        {!trimmed && <span className="text-xs text-muted-foreground">An idea needs its line.</span>}
      </div>
    </div>
  );
}

/**
 * One idea, readable or editable.
 *
 * ── Why editing had to exist ─────────────────────────────────────────────
 * The capture form asks for one line on purpose — "an idea that costs a form
 * to record is an idea that goes unrecorded" — and that bargain only holds if
 * the rest can be filled in later. It could not be. Stage was the single field
 * this screen could change after capture, so a mistyped title stayed mistyped,
 * a note written in a hurry could never be added to, and the priority the
 * journalist owns was fixed at the moment they knew least about the story.
 *
 * ── One at a time ────────────────────────────────────────────────────────
 * The parent holds which row is open rather than each row holding its own
 * flag. Two editors at once is two sets of unsaved changes with one save
 * button each, and the one you forget about is the one that loses an
 * afternoon's thinking.
 */
export function IdeaCard({
  idea,
  editing,
  onEdit,
  onDone,
  onDelete,
  onStartDraft,
  starting,
  onPickTag,
  activeTag,
}: {
  idea: Idea;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  onDelete: () => void;
  onStartDraft: () => void;
  starting: boolean;
  onPickTag: (name: string) => void;
  activeTag: string | null;
}) {
  const { genres, genreLabel } = useTaxonomy();

  if (editing) return <IdeaEditor idea={idea} genres={genres} onDone={onDone} />;

  return (
    <div className="p-4 transition-colors duration-normal hover:bg-secondary/50">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug tracking-tight">{idea.title}</p>

          {idea.note && (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {idea.note}
            </p>
          )}

          {idea.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {idea.tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onPickTag(t)}
                  aria-pressed={activeTag === t}
                  className={cn(
                    "focus-ring tap inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold transition-colors duration-normal",
                    activeTag === t
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-primary",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
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

        <div className="flex shrink-0 items-center opacity-0 transition-opacity duration-normal focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${idea.title}`}
            className="focus-ring tap-square flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-normal hover:bg-secondary hover:text-primary"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${idea.title}`}
            className="focus-ring tap-square flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-normal hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {/* The stage is the field that changes most, so it stays editable
            without opening the editor at all. No `expectedUpdatedAt` is passed,
            which now means "use the copy we hold" rather than "skip the check"
            — the API has no opt out. That is stricter than before and right: if
            another tab moved this idea on, saying so beats overwriting it. */}
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
            {STAGES.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.label}
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
            onClick={onStartDraft}
            disabled={starting}
            className="focus-ring tap inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground transition-colors duration-normal hover:bg-secondary hover:text-primary disabled:opacity-60"
          >
            {starting ? "Filing…" : "Start a draft"}
            <ArrowRight className="nudge-x h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

export { TagField };
