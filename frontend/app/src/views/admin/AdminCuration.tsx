"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, Layers, Plus, Trash2, X } from "lucide-react";
import { Reveal } from "@/components/motion";
import { WorkspaceTabs } from "@/components/admin/WorkspaceTabs";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import {
  insert,
  remove,
  saveStyleGuide,
  setPortfolioClass,
  update,
  useCuration,
  useNewsroom,
} from "@/data/newsroom/useNewsroom";
import type { Collection, Newsroom, PortfolioClass } from "@/data/newsroom/types";
import type { StorySummary } from "@/data/types";
import { useAllStories } from "@/hooks/useStories";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/toast";

/**
 * How the journalist wants their own work described.
 *
 * Three things that were modelled, served and unreachable. The store's own
 * comment names what they have in common — "one editorial idea: how the
 * journalist wants their own work described" — which is why they share a
 * screen rather than being scattered across three.
 *
 *   * The portfolio class. `PortfolioEntry` exists so that a signature
 *     investigation with modest traffic is still the signature investigation.
 *     The schema is explicit that this must not be merged with `StoryStats`,
 *     because merging them would let traffic overwrite judgement — and until
 *     now there was no way to record the judgement at all.
 *
 *   * Collections. `CollectionStory` carries a position because the order *is*
 *     the curation. Nothing could set either.
 *
 *   * House style. Preferred term, terms to avoid, and why. Now read by the
 *     pre-publication checks on every draft, which is the only place a style
 *     rule can do any work — a guide nobody is shown while writing is a
 *     document, and a document is not a check.
 */

const CLASSES: { value: PortfolioClass; label: string; note: string }[] = [
  { value: "standard", label: "Standard", note: "Ordinary published work." },
  { value: "signature", label: "Signature", note: "The pieces you would want read first." },
  { value: "investigation", label: "Investigation", note: "Sustained reporting, not a single filing." },
  { value: "award-submission", label: "Award submission", note: "Entered, or worth entering." },
];

type Tab = "portfolio" | "collections" | "style";

export default function AdminCuration() {
  const [tab, setTab] = useState<Tab>("portfolio");

  return (
    <div className="pb-24">
      <Reveal variant="fade-up">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center text-primary">
            <Layers className="h-4.5 w-4.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              Curation
            </h1>
            <p className="mt-1.5 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
              How you want your own work described — which pieces you stand behind, how they
              are grouped, and the words the house prefers. None of it is computed from
              traffic: a signature investigation with modest numbers is still the signature
              investigation.
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal variant="fade-up" delay={40}>
        <div className="mt-7">
          <WorkspaceTabs
            tabs={[
              { id: "portfolio", label: "Portfolio" },
              { id: "collections", label: "Collections" },
              { id: "style", label: "House style" },
            ]}
            active={tab}
            onChange={(id) => setTab(id as Tab)}
          />
        </div>
      </Reveal>

      <div className="mt-6">
        {tab === "portfolio" && <Portfolio />}
        {tab === "collections" && <Collections />}
        {tab === "style" && <HouseStyle />}
      </div>
    </div>
  );
}

/* ── Portfolio ───────────────────────────────────────────────── */

/**
 * Every piece, with the class it has been given.
 *
 * A list rather than a control on each story's own screen, and that is the
 * point of it: classing work is comparative. "Is this one of my signature
 * pieces" is a question about the other pieces, and it cannot be answered
 * while looking at one of them.
 *
 * Unclassed is the default and is shown as "—" rather than as "Standard".
 * They are different: standard is a judgement that a piece is ordinary, and
 * nothing has judged the ones nobody has been through yet.
 */
function Portfolio() {
  const { portfolio, loading, error } = useCuration();
  const { data: stories } = useAllStories();

  const set = async (storyId: string, value: string) => {
    const result = await setPortfolioClass(
      storyId,
      value === "" ? null : (value as PortfolioClass),
    );
    if (!result.ok) notify.error("Not saved", result.message);
  };

  if (error) return <Failed message={error} />;
  if (!stories || stories.length === 0) {
    return (
      <EmptyState
        title={loading ? "Reading the newsroom" : "No stories yet"}
        description={
          loading
            ? "One moment."
            : "Classes are given to pieces, so there is nothing to class."
        }
      />
    );
  }

  return (
    <div>
      <p className="max-w-[62ch] text-[13px] leading-relaxed text-muted-foreground">
        Your own ranking of your own work. Never derived from views — the two are kept apart
        on purpose, so a quiet investigation cannot be demoted by its traffic.
      </p>

      <ul className="mt-5 space-y-2">
        {stories.map((story) => (
          <li
            key={story.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-3.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{story.title}</p>
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                {story.status === "published" ? "Published" : story.status} · {story.genre}
              </p>
            </div>
            <label className="sr-only" htmlFor={`class-${story.id}`}>
              Portfolio class for {story.title}
            </label>
            <select
              id={`class-${story.id}`}
              value={portfolio[story.id] ?? ""}
              onChange={(event) => void set(story.id, event.target.value)}
              className="focus-ring h-10 shrink-0 rounded-md border border-border bg-background px-3 text-[13px]"
            >
              <option value="">— unclassed —</option>
              {CLASSES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>

      <dl className="mt-6 grid gap-2 sm:grid-cols-2">
        {CLASSES.map((entry) => (
          <div key={entry.value} className="text-[12px] leading-snug">
            <dt className="font-semibold text-foreground">{entry.label}</dt>
            <dd className="text-muted-foreground">{entry.note}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ── Collections ─────────────────────────────────────────────── */

/**
 * Ordered groups of pieces.
 *
 * The order is data, not a display preference — `CollectionStory.position` is
 * a column and the schema says why: "the order *is* the curation". So it is
 * moved explicitly, with buttons, rather than by a sort the screen chooses.
 *
 * Up and down rather than drag-and-drop, deliberately. Drag is nicer with a
 * mouse and unusable without one; two buttons work from a keyboard, work on a
 * phone, and say what they do to a screen reader. A list that is reordered
 * once a month does not need the fancier interaction, and the fancier
 * interaction is the one that excludes people.
 */
function Collections() {
  const {
    newsroom: { collections },
    loading,
    error,
  } = useNewsroom("collections");
  const { data: stories } = useAllStories();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const byId = useMemo(() => {
    const map = new Map<string, StorySummary>();
    for (const story of stories ?? []) map.set(story.id, story);
    return map;
  }, [stories]);

  const create = async (title: string) => {
    if (!title.trim()) return;
    const result = await insert("collections", { title: title.trim(), description: "", storyIds: [] });
    if (result.ok) {
      setAdding(false);
      setEditing(result.value.id);
      return;
    }
    notify.error("Not created", result.message);
  };

  if (error) return <Failed message={error} />;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-[62ch] text-[13px] leading-relaxed text-muted-foreground">
          A themed run of pieces, in the order you want them read. Collections and portfolio
          classes are the only newsroom state the public site is allowed to carry.
        </p>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New collection
          </Button>
        )}
      </div>

      {adding && <NewCollection onCreate={create} onCancel={() => setAdding(false)} />}

      {collections.length === 0 && !adding && (
        <div className="mt-4">
          <EmptyState
            title={loading ? "Reading the newsroom" : "No collections yet"}
            description={
              loading
                ? "One moment."
                : "Group a few related pieces and give the run a name."
            }
          />
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {collections.map((collection) => (
          <li key={collection.id} className="rounded-lg border border-border bg-background p-4">
            <CollectionRow
              collection={collection}
              stories={stories ?? []}
              byId={byId}
              open={editing === collection.id}
              onToggle={() => setEditing(editing === collection.id ? null : collection.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewCollection({
  onCreate,
  onCancel,
}: {
  onCreate: (title: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-background p-3.5">
      <label className="sr-only" htmlFor="collection-title">
        Collection title
      </label>
      <input
        id="collection-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void onCreate(title);
          }
        }}
        placeholder="What the run is called"
        className="focus-ring h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
      />
      <Button size="sm" onClick={() => void onCreate(title)} disabled={!title.trim()}>
        <Check className="h-3.5 w-3.5" aria-hidden />
        Create
      </Button>
      <Button size="sm" variant="quiet" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

function CollectionRow({
  collection,
  stories,
  byId,
  open,
  onToggle,
}: {
  collection: Collection;
  stories: StorySummary[];
  byId: Map<string, StorySummary>;
  open: boolean;
  onToggle: () => void;
}) {
  const [description, setDescription] = useState(collection.description);

  const write = async (patch: Partial<Collection>) => {
    const result = await update("collections", collection.id, patch);
    if (!result.ok) notify.error("Not saved", result.message);
  };

  const move = (index: number, delta: number) => {
    const next = [...collection.storyIds];
    const to = index + delta;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to]!, next[index]!];
    void write({ storyIds: next });
  };

  const unlisted = stories.filter((story) => !collection.storyIds.includes(story.id));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{collection.title}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {collection.storyIds.length} piece{collection.storyIds.length === 1 ? "" : "s"}
            {collection.description ? ` · ${collection.description}` : ""}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onToggle}>
          {open ? "Done" : "Edit"}
        </Button>
        <Button
          size="sm"
          variant="quiet"
          onClick={() => {
            void remove("collections", collection.id).then((result) => {
              if (!result.ok) notify.error("Not deleted", result.message);
            });
          }}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>

      {open && (
        <div className="mt-4 border-t border-border pt-4">
          <label
            htmlFor={`desc-${collection.id}`}
            className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Description
          </label>
          <input
            id={`desc-${collection.id}`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => {
              if (description !== collection.description) void write({ description });
            }}
            placeholder="What holds these together"
            className="focus-ring mt-1.5 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
          />

          <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            In order
          </p>
          {collection.storyIds.length === 0 ? (
            <p className="mt-2 text-[13px] text-muted-foreground">Nothing in it yet.</p>
          ) : (
            <ol className="mt-2 space-y-1.5">
              {collection.storyIds.map((storyId, index) => (
                <li
                  key={storyId}
                  className="flex items-center gap-2 rounded-md bg-secondary/60 px-2.5 py-2"
                >
                  <span className="w-5 shrink-0 text-[12px] font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {byId.get(storyId)?.title ?? "A piece that is no longer here"}
                  </span>
                  <MoveButton
                    label="Move up"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                  </MoveButton>
                  <MoveButton
                    label="Move down"
                    disabled={index === collection.storyIds.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                  </MoveButton>
                  <MoveButton
                    label="Remove from collection"
                    onClick={() =>
                      void write({
                        storyIds: collection.storyIds.filter((id) => id !== storyId),
                      })
                    }
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </MoveButton>
                </li>
              ))}
            </ol>
          )}

          {unlisted.length > 0 && (
            <div className="mt-4">
              <label
                htmlFor={`add-${collection.id}`}
                className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Add a piece
              </label>
              <select
                id={`add-${collection.id}`}
                value=""
                onChange={(event) => {
                  if (!event.target.value) return;
                  void write({ storyIds: [...collection.storyIds, event.target.value] });
                }}
                className="focus-ring mt-1.5 h-10 w-full rounded-md border border-border bg-background px-3 text-[13px]"
              >
                <option value="">Choose a piece…</option>
                {unlisted.map((story) => (
                  <option key={story.id} value={story.id}>
                    {story.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MoveButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="focus-ring tap flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-background hover:text-primary disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/* ── House style ─────────────────────────────────────────────── */

/**
 * The style guide, edited whole and saved whole.
 *
 * That is the API's shape and its reason is good: a guide is edited in one
 * sitting, and five requests that can half-fail model that worse than one that
 * cannot. So this holds a local copy, and "Save" is explicit — there is no
 * autosave, because a half-typed rule saved on a debounce would immediately
 * start firing against every draft.
 */
function HouseStyle() {
  const { styleGuide, loading, error } = useCuration();
  const [entries, setEntries] = useState<Newsroom["styleGuide"] | null>(null);
  const [saving, setSaving] = useState(false);

  // Seeded from the server copy the first time it arrives, then owned here.
  const rows = entries ?? styleGuide;

  const edit = (index: number, patch: Partial<Newsroom["styleGuide"][number]>) =>
    setEntries(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const save = async () => {
    setSaving(true);
    const result = await saveStyleGuide(
      rows
        .map((row) => ({
          preferred: row.preferred.trim(),
          avoid: row.avoid.map((word) => word.trim()).filter(Boolean),
          why: row.why?.trim() || undefined,
        }))
        // A rule with no preferred term has nothing to prefer, and one with
        // nothing to avoid can never fire. Dropped rather than saved as
        // clutter that would sit in the list looking like a rule.
        .filter((row) => row.preferred && row.avoid.length > 0),
    );
    setSaving(false);

    if (result.ok) {
      setEntries(null);
      notify.success("House style saved", "The pre-publication checks read it from now on.");
      return;
    }
    notify.error("Not saved", result.message);
  };

  if (error) return <Failed message={error} />;

  return (
    <div>
      <p className="max-w-[62ch] text-[13px] leading-relaxed text-muted-foreground">
        Your own preferred terms, and what they replace. The pre-publication checks under
        every draft read this list and point at the sentence — they never rewrite it, because
        style is your decision and a check that overruled you would be claiming an authority
        it got from a form.
      </p>

      {rows.length === 0 && !loading && (
        <div className="mt-4">
          <EmptyState
            title="No house style yet"
            description="Add a rule and it starts appearing in the checks under every draft."
          />
        </div>
      )}

      <ul className="mt-5 space-y-3">
        {rows.map((row, index) => (
          <li key={index} className="rounded-lg border border-border bg-background p-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Labelled label="Prefer" id={`pref-${index}`}>
                <input
                  id={`pref-${index}`}
                  value={row.preferred}
                  onChange={(event) => edit(index, { preferred: event.target.value })}
                  placeholder="The term the house uses"
                  className="focus-ring h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
                />
              </Labelled>
              <Labelled label="Instead of" id={`avoid-${index}`}>
                <input
                  id={`avoid-${index}`}
                  value={row.avoid.join(", ")}
                  onChange={(event) =>
                    edit(index, { avoid: event.target.value.split(",").map((w) => w.trimStart()) })
                  }
                  placeholder="Comma separated"
                  className="focus-ring h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
                />
              </Labelled>
              <div className="sm:col-span-2">
                <Labelled label="Why" id={`why-${index}`}>
                  <input
                    id={`why-${index}`}
                    value={row.why ?? ""}
                    onChange={(event) => edit(index, { why: event.target.value })}
                    placeholder="Shown in the check, so the reason travels with the rule"
                    className="focus-ring h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
                  />
                </Labelled>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setEntries(rows.filter((_, i) => i !== index))}
              className="focus-ring mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Remove this rule
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEntries([...rows, { preferred: "", avoid: [] }])}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add a rule
        </Button>
        <Button size="sm" onClick={() => void save()} disabled={saving || entries === null}>
          <Check className="h-3.5 w-3.5" aria-hidden />
          {saving ? "Saving…" : "Save house style"}
        </Button>
        {entries !== null && !saving && (
          <span className="text-[12px] text-muted-foreground">Unsaved changes.</span>
        )}
      </div>
    </div>
  );
}

function Labelled({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Failed({ message }: { message: string }) {
  return (
    <p className={cn("rounded-lg border border-destructive/30 bg-destructive/[0.06] p-4 text-sm text-muted-foreground")}>
      {message}
    </p>
  );
}
