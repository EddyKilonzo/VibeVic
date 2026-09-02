"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { insert, remove, update, useNewsroom } from "@/data/newsroom/useNewsroom";
import type { ListKey } from "@/data/newsroom/store";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";
import { notify } from "@/lib/toast";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { RecordField } from "@/components/admin/RecordField";
import {
  RECORD_SCHEMAS,
  collectionsNeededBy,
  type Draft,
  type Field,
  type RecordKey,
} from "@/lib/newsroom-schema";

/**
 * One newsroom collection, listed and edited.
 *
 * ── The same panel eight times ───────────────────────────────────────────
 * Sources, quotes, interviews, entities, evidence, timeline events, notes and
 * deadlines all render through this, driven by `lib/newsroom-schema`. The
 * argument for that is in the schema file; what it buys here is that every
 * collection gets the same behaviour without anybody having to remember to
 * implement it eight times — one record open at a time, an explicit save, a
 * delete that says what it removed, and the API's own refusal sentence
 * forwarded rather than replaced.
 *
 * ── Scoped to a story, or not ────────────────────────────────────────────
 * With a `storyId` this shows only the records attached to that piece, and a
 * new record is attached on creation. Without one it shows the whole
 * collection — the newsroom-wide view, where material that is not yet about
 * any particular story lives.
 *
 * Filtering happens here rather than in a request, and that is a deliberate
 * limit rather than an oversight: the API has no per-story record route, the
 * collections are small enough that the whole list is already in the store for
 * every other screen, and adding a query parameter would mean a second read
 * path with its own visibility filtering to get right. The day a newsroom
 * holds enough records for this to matter is the day to add the route.
 *
 * ── Seeded once, then owned ──────────────────────────────────────────────
 * The editor's state is seeded from the row it opened on and then belongs to
 * the editor, so typing does not race the store. A change arriving from
 * another tab mid-edit will not appear in these fields, and the save will be
 * refused with a 409 rather than silently overwriting it — the same trade
 * `IdeaCard` makes, for the same reason.
 */

export function RecordPanel({
  collection,
  storyId,
}: {
  collection: RecordKey;
  /** When given, the panel is about one piece and nothing else. */
  storyId?: string;
}) {
  const schema = RECORD_SCHEMAS[collection];
  const needed = useMemo(() => collectionsNeededBy(collection), [collection]);
  const { newsroom, loading, error } = useNewsroom(...(needed as ListKey[]));

  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const reduced = useReducedMotion();
  const Extra = schema.extra;

  const rows = useMemo(() => {
    const all = (newsroom[collection] as unknown as Draft[]) ?? [];
    if (!storyId) return all;
    if (schema.storyLink === "many") {
      return all.filter((row) => asIds(row.storyIds).includes(storyId));
    }
    if (schema.storyLink === "one") {
      return all.filter((row) => row.storyId === storyId);
    }
    return all;
  }, [newsroom, collection, storyId, schema.storyLink]);

  /* Rows a `ref`/`refs` field can point at, resolved once for the panel. */
  const choices = useMemo(() => {
    const out: Partial<Record<RecordKey, { id: string; label: string }[]>> = {};
    for (const field of schema.fields) {
      if (!field.from || out[field.from]) continue;
      const from = RECORD_SCHEMAS[field.from];
      out[field.from] = ((newsroom[field.from] as unknown as Draft[]) ?? []).map((row) => ({
        id: String(row.id),
        label: from.title(row),
      }));
    }
    return out;
  }, [newsroom, schema.fields]);

  const create = async (draft: Draft) => {
    const payload = { ...draft };
    if (storyId && schema.storyLink === "many") payload.storyIds = [storyId];
    if (storyId && schema.storyLink === "one") payload.storyId = storyId;

    const result = await insert(collection as ListKey, cleaned(payload, schema.fields) as never);
    if (result.ok) {
      setAdding(false);
      notify.success(`Added a ${schema.singular}`, storyId ? "Filed against this piece." : undefined);
      return true;
    }
    notify.error(`The ${schema.singular} was not saved`, result.message);
    return false;
  };

  const save = async (id: string, draft: Draft) => {
    const result = await update(collection as ListKey, id, cleaned(draft, schema.fields) as never);
    if (result.ok) {
      setEditing(null);
      notify.success("Saved");
      return true;
    }
    notify.error(
      result.reason === "conflict" ? "Someone else changed this first" : "Not saved",
      result.message,
    );
    return false;
  };

  const destroy = async (row: Draft) => {
    const label = schema.title(row);
    const result = await remove(collection as ListKey, String(row.id));
    if (result.ok) {
      // No undo offer. Re-creating produces a new record with a new id and a
      // new creation date — the store says so explicitly — and a button
      // labelled "Undo" that quietly does something else is worse than none.
      notify.success("Deleted", label);
      return;
    }
    notify.error("Not deleted", result.message);
  };

  if (error) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/[0.06] p-4 text-sm text-muted-foreground">
        {error}
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-[62ch] text-[13px] leading-relaxed text-muted-foreground">
          {schema.blurb}
        </p>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add
          </Button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {adding && (
          <motion.div
            initial={reduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduced ? undefined : { opacity: 0, height: 0 }}
            transition={transitions.normal}
            className="overflow-hidden"
          >
            <RecordForm
              schema={schema}
              initial={schema.blank()}
              choices={choices}
              submitLabel={`Add ${schema.singular}`}
              onSubmit={create}
              onCancel={() => setAdding(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {rows.length === 0 && !adding && (
        <div className="mt-4">
          <EmptyState
            title={loading ? "Loading…" : `No ${schema.plural.toLowerCase()} yet`}
            description={
              loading
                ? "Reading the newsroom."
                : storyId
                  ? "Nothing filed against this piece yet."
                  : "Nothing here yet."
            }
          />
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {rows.map((row) => {
          const id = String(row.id);
          const open = editing === id;

          return (
            <li
              key={id}
              className={cn(
                "rounded-lg border border-border bg-background transition-colors",
                open && "border-accent/40",
              )}
            >
              {open ? (
                <RecordForm
                  schema={schema}
                  initial={row}
                  choices={choices}
                  submitLabel="Save"
                  onSubmit={(draft) => save(id, draft)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="flex items-start gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-semibold leading-snug text-foreground",
                        row.done === true && "line-through opacity-60",
                      )}
                    >
                      {schema.title(row)}
                    </p>
                    {schema.subtitle?.(row) && (
                      <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                        {schema.subtitle(row)}
                      </p>
                    )}
                    {typeof row.visibility === "string" && (
                      <VisibilityTag visibility={row.visibility} />
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {/* The one control a collection can have that the schema
                        cannot describe — see `RecordSchema.extra`. */}
                    {Extra && <Extra record={row} />}
                    <IconButton label="Edit" onClick={() => setEditing(id)}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </IconButton>
                    <IconButton label="Delete" onClick={() => void destroy(row)} destructive>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </IconButton>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The form for one record, add and edit alike.
 *
 * Keyed on nothing and seeded from `initial` once — see the note at the top of
 * the file. `required` is checked here so a missing headline is a sentence
 * under the field rather than a 400 from the API, but the API checks it again:
 * this is a courtesy, not the rule.
 */
function RecordForm({
  schema,
  initial,
  choices,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  schema: (typeof RECORD_SCHEMAS)[RecordKey];
  initial: Draft;
  choices: Partial<Record<RecordKey, { id: string; label: string }[]>>;
  submitLabel: string;
  onSubmit: (draft: Draft) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => ({ ...schema.blank(), ...initial }));
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);

  const set = (name: string, value: unknown) =>
    setDraft((current) => ({ ...current, [name]: value }));

  const submit = async () => {
    const blank = schema.fields
      .filter((field) => field.required && shown(field, draft))
      .filter((field) => !filled(draft[field.name]))
      .map((field) => field.label);

    if (blank.length > 0) {
      setMissing(blank);
      return;
    }

    setSaving(true);
    const ok = await onSubmit(draft);
    setSaving(false);
    if (ok) setMissing([]);
  };

  return (
    <div className="p-3.5">
      <div className="grid gap-3.5 sm:grid-cols-2">
        {schema.fields
          .filter((field) => shown(field, draft))
          .map((field) => (
            <RecordField
              key={field.name}
              id={`${schema.key}-${field.name}`}
              field={field}
              value={draft[field.name]}
              onChange={(value) => set(field.name, value)}
              options={field.from ? choices[field.from] : undefined}
            />
          ))}
      </div>

      {missing.length > 0 && (
        <p className="mt-3 text-[12px] text-destructive">
          Still needed: {missing.join(", ")}.
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" onClick={() => void submit()} disabled={saving}>
          <Check className="h-3.5 w-3.5" aria-hidden />
          {saving ? "Saving…" : submitLabel}
        </Button>
        <Button size="sm" variant="quiet" onClick={onCancel} disabled={saving}>
          <X className="h-3.5 w-3.5" aria-hidden />
          Cancel
        </Button>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "focus-ring tap flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors",
        destructive ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-secondary hover:text-primary",
      )}
    >
      {children}
    </button>
  );
}

/**
 * The tier, on the row.
 *
 * Shown always rather than only for confidential records, because "this one is
 * marked and that one is not" invites the reading that unmarked means safe.
 * Every tiered record says which tier it is in.
 */
function VisibilityTag({ visibility }: { visibility: string }) {
  return (
    <span
      className={cn(
        "mt-1.5 inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide",
        visibility === "confidential"
          ? "bg-destructive/12 text-destructive"
          : visibility === "publishable"
            ? "bg-primary/10 text-primary"
            : "bg-secondary text-muted-foreground",
      )}
    >
      {visibility}
    </span>
  );
}

/* ── Small helpers ───────────────────────────────────────────── */

function asIds(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

function shown(field: Field, draft: Draft): boolean {
  return field.when ? field.when(draft) : true;
}

function filled(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null;
}

/**
 * The draft, as a payload the API will accept.
 *
 * Three things happen, and each one is a 400 avoided:
 *
 *   * Server-owned fields are dropped. The store strips `id`, `createdAt` and
 *     `updatedAt` already; what it cannot know is that a row also carries
 *     fields the DTO never declared, and `forbidNonWhitelisted` refuses those
 *     outright. Building the payload from the schema rather than from the row
 *     means only declared fields are ever sent.
 *
 *   * Empty strings become absent. A cleared optional input is `""`, and the
 *     API validates several of these — `url` with `@IsUrl`, every date with
 *     `@IsISO8601` — so `""` is a refusal rather than "no value".
 *
 *   * Dates become full instants. A `date` input gives `YYYY-MM-DD`, which is
 *     valid ISO 8601 and reaches the database as midnight UTC; that is right
 *     for a date and wrong for a deadline, where the time of day is the
 *     promise. `datetime-local` values carry no zone at all, so they are read
 *     in the browser's zone — the one the writer was sitting in when they
 *     typed the time.
 */
function cleaned(draft: Draft, fields: readonly Field[]): Draft {
  const out: Draft = {};

  for (const field of fields) {
    if (!shown(field, draft)) continue;
    const value = draft[field.name];

    if (field.kind === "toggle") {
      out[field.name] = value === true;
      continue;
    }

    if (field.kind === "datetime" && typeof value === "string" && value) {
      const at = new Date(value);
      if (!Number.isNaN(at.getTime())) out[field.name] = at.toISOString();
      continue;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) out[field.name] = trimmed;
      continue;
    }

    if (Array.isArray(value)) {
      out[field.name] = value;
      continue;
    }
  }

  // Story links are set by the panel, not by a field, so they are carried
  // across separately — they are the one part of the payload the schema does
  // not describe.
  if (Array.isArray(draft.storyIds)) out.storyIds = draft.storyIds;
  if (typeof draft.storyId === "string" && draft.storyId) out.storyId = draft.storyId;

  return out;
}
