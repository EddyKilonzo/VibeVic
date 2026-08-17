"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  Reorder,
  motion,
  useDragControls,
  useReducedMotion,
} from "motion/react";
import {
  ArrowLeft,
  Check,
  Cloud,
  Copy,
  GripVertical,
  Headphones,
  Pause,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import type { Block, BlockType, Story, StoryStatus } from "@/data/types";
import { GENRES, storyById } from "@/data/content";
import { cn } from "@/lib/utils";
import { stagger, transitions } from "@/lib/motion";
import { formatRelative } from "@/lib/format";
import { notify } from "@/lib/toast";
import { useAutosave, type SaveStatus } from "@/hooks/useAutosave";
import { readDraft, writeDraft, type StoredDraft } from "@/lib/drafts";
import { useVoice } from "@/context/VoiceProvider";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/Button";

let idSeq = 0;
const newId = () => `nb${Date.now()}-${++idSeq}`;

const BLOCK_LABEL: Record<BlockType, string> = {
  paragraph: "Paragraph",
  heading: "Heading",
  quote: "Pull quote",
  list: "List",
  image: "Image",
  divider: "Divider",
};

function emptyBlock(type: BlockType): Block {
  const id = newId();
  switch (type) {
    case "heading":
      return { id, type, text: "", level: 2 };
    case "quote":
      return { id, type, text: "" };
    case "list":
      return { id, type, items: [""] };
    case "image":
      return { id, type, src: id, alt: "", caption: "" };
    case "divider":
      return { id, type };
    default:
      return { id, type: "paragraph", text: "" };
  }
}

const BLANK: Story = {
  id: "new",
  slug: "",
  title: "",
  dek: "",
  genre: GENRES[0]?.slug ?? "features",
  tags: [],
  status: "draft",
  publishedAt: new Date().toISOString().slice(0, 10),
  updatedAt: new Date().toISOString().slice(0, 10),
  readingMinutes: 1,
  body: [emptyBlock("paragraph")],
};

/**
 * The article editor.
 *
 * Blocks, not markup — which is what makes reordering, conversion and the
 * narration preview possible without parsing anything. Drag is handled by
 * Motion's `Reorder`, so the surrounding blocks animate out of the way as an
 * item moves rather than snapping after the drop.
 *
 * Controls stay hidden until a block is hovered or focused. An editor covered
 * in affordances is an editor you cannot read your own writing in.
 */
export default function StoryWorkspace({ id }: { id?: string }) {
  const existing = id ? storyById(id) : undefined;
  const reduced = useReducedMotion();

  const [draft, setDraft] = useState<Story>(() =>
    existing ? { ...existing, body: [...existing.body] } : BLANK,
  );
  const [activeBlock, setActiveBlock] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Switching to a different story loads that story's draft. Tracked by id
  // rather than by object identity, so a re-render of the same piece can never
  // discard edits the journalist has made but not yet saved.
  const [loadedId, setLoadedId] = useState(existing?.id);
  if (existing && existing.id !== loadedId) {
    setLoadedId(existing.id);
    setDraft({ ...existing, body: [...existing.body] });
  }

  /**
   * Autosave.
   *
   * This used to be `setTimeout(450)` around a discarded argument, and every
   * label attached to it was therefore a claim about something that had not
   * happened — "Saved 2 minutes ago" over a draft that existed only in React
   * state, and lost in full the moment the tab closed. It writes to the
   * browser now, which is the only store this product has until the API
   * lands, and the indicator says which store that is.
   */
  const save = useCallback(async (value: Story) => {
    writeDraft(value);
  }, []);

  const { status, savedAt } = useAutosave(draft, save);

  /**
   * A local draft newer than the seed copy.
   *
   * Offered, never applied. The stored draft and the published story can
   * legitimately disagree, and picking one automatically is how somebody's
   * afternoon disappears — so the workspace opens the published copy, which
   * is the one the site is serving, and says the other exists.
   */
  const [stored, setStored] = useState<StoredDraft | null>(null);
  const [restoreOffer, setRestoreOffer] = useState(true);
  const targetId = existing?.id ?? "new";

  /**
   * Read once the sheet is on the page, via a ref callback.
   *
   * Not in render: this route is prerendered, so storage read during the
   * first client pass disagrees with the HTML React is hydrating against.
   * Not in an effect body either — that is the cascading-render pattern, and
   * the ref callback fires at exactly the moment we need and re-fires when
   * `targetId` changes it, which is also when the offer should come back.
   */
  const pickUpDraft = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      setStored(readDraft(targetId));
      setRestoreOffer(true);
    },
    [targetId],
  );

  const restore = () => {
    if (!stored) return;
    setDraft({ ...stored.story, body: [...stored.story.body] });
    setRestoreOffer(false);
    notify.success("Local draft restored", `Saved ${formatRelative(stored.savedAt)}`);
  };

  const wordCount = useMemo(
    () =>
      draft.body
        .map((b) => ("text" in b ? b.text : "items" in b ? b.items.join(" ") : ""))
        .join(" ")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length,
    [draft.body],
  );

  /* ── Block operations ───────────────────────────────────────── */

  const updateBlock = (blockId: string, patch: Partial<Block>) =>
    setDraft((d) => ({
      ...d,
      body: d.body.map((b) => (b.id === blockId ? ({ ...b, ...patch } as Block) : b)),
    }));

  const insertAfter = (blockId: string, type: BlockType = "paragraph") =>
    setDraft((d) => {
      const index = d.body.findIndex((b) => b.id === blockId);
      const next = [...d.body];
      next.splice(index + 1, 0, emptyBlock(type));
      return { ...d, body: next };
    });

  const duplicate = (blockId: string) =>
    setDraft((d) => {
      const index = d.body.findIndex((b) => b.id === blockId);
      const copy = { ...d.body[index], id: newId() } as Block;
      const next = [...d.body];
      next.splice(index + 1, 0, copy);
      return { ...d, body: next };
    });

  const remove = (blockId: string) => {
    const block = draft.body.find((b) => b.id === blockId);
    setDraft((d) => ({ ...d, body: d.body.filter((b) => b.id !== blockId) }));
    if (block) {
      notify.undo("Block deleted", () =>
        setDraft((d) => ({ ...d, body: [...d.body, block] })),
      );
    }
  };

  const convert = (blockId: string, type: BlockType) =>
    setDraft((d) => ({
      ...d,
      body: d.body.map((b) => {
        if (b.id !== blockId) return b;
        const text = "text" in b ? b.text : "items" in b ? b.items.join(" ") : "";
        const fresh = emptyBlock(type);
        if ("text" in fresh) fresh.text = text;
        if ("items" in fresh && text) fresh.items = [text];
        return { ...fresh, id: b.id };
      }),
    }));

  /**
   * Sets the draft's own status field. It does not publish anything.
   *
   * The toast used to read "Story published", which was false in the way that
   * matters most: the site had not changed, no request had been made, and the
   * writer had every reason to believe their piece was live. Marking a draft
   * as ready is a real and useful act — it is just not the same act, and the
   * interface now uses the same word for it that the writer would.
   */
  const setStatus = (next: StoryStatus) => {
    setDraft((d) => ({ ...d, status: next }));
    notify.success(
      next === "published"
        ? "Marked ready to publish"
        : next === "scheduled"
          ? "Marked as scheduled"
          : "Moved back to drafts",
      "Saved on this device — the site is unchanged.",
    );
  };

  return (
    <div ref={pickUpDraft} className="mx-auto max-w-[900px] pb-24">
      <Reveal variant="fade-up">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/stories"
            className="focus-ring tap inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Stories
          </Link>

          <SaveIndicator status={status} savedAt={savedAt} />

          <div className="ml-auto flex items-center gap-2">
            <NarrationPreview draft={draft} />
            {/* "Mark ready", not "Publish". There is no API to publish to, and
                a button that says the word does not become true for being
                pressed — it just sends the writer away believing the piece is
                live. The line under the sheet says where the work actually
                is. */}
            {draft.status === "published" ? (
              <Button size="sm" variant="outline" onClick={() => setStatus("draft")}>
                Move to drafts
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStatus("published")}>
                Mark ready
              </Button>
            )}
          </div>
        </div>
      </Reveal>

      {/* The offer to restore, when a newer local copy exists. Never applied
          on its own — see `lib/drafts`. */}
      {stored && restoreOffer && stored.savedAt > (existing?.updatedAt ?? "") && (
        <Reveal
          variant="fade-up"
          delay={30}
          className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-accent/30 bg-accent/[0.07] p-3.5"
        >
          <p className="min-w-0 flex-1 text-sm leading-snug text-muted-foreground">
            <span className="font-semibold text-primary">
              You have an unsent draft of this piece
            </span>{" "}
            on this device, saved {formatRelative(stored.savedAt)}. The published copy is open.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" onClick={restore}>
              Open the draft
            </Button>
            <Button size="sm" variant="quiet" onClick={() => setRestoreOffer(false)}>
              Keep this one
            </Button>
          </div>
        </Reveal>
      )}

      {/* Headline and standfirst */}
      {/* The writing surface: a raised sheet the draft lives on, so the
          editor reads as a page being written rather than a form being
          filled in. Everything chrome-like stays outside it. */}
      <Reveal variant="fade-up" delay={60} className="surface mt-8 px-6 py-8 sm:px-10 sm:py-10">
        <textarea
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="Headline"
          rows={2}
          className="font-display display-2 w-full resize-none bg-transparent font-semibold outline-none placeholder:text-muted-foreground/30"
        />
        <textarea
          value={draft.dek}
          onChange={(e) => setDraft((d) => ({ ...d, dek: e.target.value }))}
          placeholder="Standfirst — one sentence on why this matters."
          rows={2}
          className="font-display lead-copy mt-5 w-full resize-none bg-transparent text-muted-foreground outline-none placeholder:text-muted-foreground/30"
        />

        <div className="mt-5 flex flex-wrap items-center gap-3 border-y border-border py-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            <span className="rule-label">Beat</span>
            <select
              value={draft.genre}
              onChange={(e) => setDraft((d) => ({ ...d, genre: e.target.value }))}
              className="focus-ring tap rounded border border-border bg-background px-2 py-1 text-xs"
            >
              {GENRES.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <span aria-hidden className="h-3 w-px bg-border" />
          <span>
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </span>
          <span aria-hidden className="h-3 w-px bg-border" />
          <span>
            {draft.body.length} {draft.body.length === 1 ? "block" : "blocks"}
          </span>
          {/* Same pill vocabulary as the story list, and the same contrast
              fix: `text-accent` on `bg-accent/12` measured 2.8:1 at 11px
              semibold, where 4.5:1 applies. */}
          <span
            className={cn(
              "ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
              draft.status === "published"
                ? "bg-primary text-primary-foreground"
                : draft.status === "scheduled"
                  ? "bg-accent/12 text-primary ring-1 ring-inset ring-accent/35"
                  : "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
            )}
          >
            {draft.status === "published" ? "ready" : draft.status}
          </span>
        </div>

        {/* Where the work is. Stated on the sheet rather than left for the
            writer to infer from a toast they have already dismissed. */}
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          Drafts are held in this browser. Nothing here reaches the public site
          yet — that arrives with the API.
        </p>
      </Reveal>

      {/* Blocks */}
      <Reorder.Group
        axis="y"
        values={draft.body}
        onReorder={(body) => setDraft((d) => ({ ...d, body }))}
        className="drag-zone surface mt-6 space-y-1 px-6 py-8 sm:px-10 sm:py-10"
        data-dimmed={dragging || undefined}
      >
        {draft.body.map((block, i) => (
          <BlockRow
            key={block.id}
            block={block}
            index={i}
            active={activeBlock === block.id}
            onFocus={() => setActiveBlock(block.id)}
            onBlur={() => setActiveBlock((current) => (current === block.id ? null : current))}
            onDragStart={() => setDragging(true)}
            onDragEnd={() => setDragging(false)}
            onChange={(patch) => updateBlock(block.id, patch)}
            onInsert={(type) => insertAfter(block.id, type)}
            onDuplicate={() => duplicate(block.id)}
            onRemove={() => remove(block.id)}
            onConvert={(type) => convert(block.id, type)}
            reduced={!!reduced}
          />
        ))}
      </Reorder.Group>

      <button
        type="button"
        onClick={() =>
          setDraft((d) => ({ ...d, body: [...d.body, emptyBlock("paragraph")] }))
        }
        className="focus-ring mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border text-sm font-semibold text-muted-foreground transition-colors duration-normal hover:border-accent hover:text-accent"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Add a block
      </button>
    </div>
  );
}

/* ── Save indicator ──────────────────────────────────────────────
   Three states, each visibly distinct: unsaved, saving, saved.     */

function SaveIndicator({ status, savedAt }: { status: SaveStatus; savedAt: Date | null }) {
  const reduced = useReducedMotion();

  // "on this device" is doing real work in these labels. A bare "Saved" over
  // a browser-only store is the same promise a CMS makes, and the writer has
  // no way to tell the difference until they open the site on another machine
  // and find nothing there.
  const label =
    status === "saving"
      ? "Saving…"
      : status === "unsaved"
        ? "Unsaved changes"
        : status === "error"
          ? "Couldn't save — copy your work"
          : savedAt
            ? `Saved on this device ${formatRelative(savedAt.toISOString())}`
            : "Up to date";

  return (
    <span
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 text-xs font-medium",
        status === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={status}
            initial={reduced ? false : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
            transition={transitions.fast}
            className="absolute inset-0 flex items-center justify-center"
          >
            {status === "saving" ? (
              <Cloud className="h-3.5 w-3.5 animate-pulse" aria-hidden />
            ) : status === "saved" ? (
              <Check className="h-3.5 w-3.5 text-accent" aria-hidden />
            ) : (
              <Cloud className="h-3.5 w-3.5" aria-hidden />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
      {label}
    </span>
  );
}

/* ── Narration preview ───────────────────────────────────────────
   Lets the writer hear the piece before publishing it — catching the
   abbreviations and names that read badly aloud.                   */

function NarrationPreview({ draft }: { draft: Story }) {
  const { supported, load, play, pause, stop, state, activeSentence } = useVoice();
  const playing = state === "playing";

  useEffect(() => () => stop(), [stop]);

  if (!supported) return null;

  const onToggle = () => {
    if (playing) {
      pause();
      return;
    }
    load(draft.slug || "preview", draft.title || "Untitled", draft.body);
    // load() is synchronous state; play reads the freshly loaded article.
    window.setTimeout(() => play(), 0);
  };

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={onToggle}>
        {playing ? (
          <Pause className="h-4 w-4" aria-hidden />
        ) : (
          <Headphones className="h-4 w-4" aria-hidden />
        )}
        {playing ? "Pause" : "Preview narration"}
      </Button>

      <AnimatePresence>
        {playing && activeSentence && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={transitions.normal}
            className="hidden max-w-[240px] truncate text-xs italic text-muted-foreground lg:block"
          >
            “{activeSentence}”
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── One block ───────────────────────────────────────────────── */

interface BlockRowProps {
  block: Block;
  index: number;
  active: boolean;
  reduced: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onChange: (patch: Partial<Block>) => void;
  onInsert: (type: BlockType) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onConvert: (type: BlockType) => void;
}

function BlockRow({
  block,
  index,
  active,
  reduced,
  onFocus,
  onBlur,
  onDragStart,
  onDragEnd,
  onChange,
  onInsert,
  onDuplicate,
  onRemove,
  onConvert,
}: BlockRowProps) {
  const controls = useDragControls();
  const [held, setHeld] = useState(false);

  return (
    <Reorder.Item
      value={block}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => {
        setHeld(true);
        onDragStart();
      }}
      onDragEnd={() => {
        setHeld(false);
        onDragEnd();
      }}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { ...transitions.normal, delay: Math.min(index, 8) * stagger.tight },
      }}
      className={cn(
        "drag-item group/block relative rounded-lg transition-shadow duration-normal",
        held && "z-10 bg-card shadow-lifted",
      )}
      data-dragging={held || undefined}
    >
      {/* Gutter controls.

          They used to be `lg:flex` and nothing else, parked 96px outside the
          sheet where there is only room for them on a wide screen. Below
          `lg` that left no drag handle and no way to insert between two
          blocks — the entire reordering capability, and half the composing
          one, simply did not exist on a tablet. The order of an article is
          not a desktop concern.

          So: outside the sheet where there is room, and inside it as a row
          above the block where there is not. */}
      <div
        className={cn(
          "absolute -left-24 top-1 hidden items-center gap-0.5 transition-opacity duration-normal lg:flex",
          active || held ? "opacity-100" : "opacity-0 group-hover/block:opacity-100",
        )}
      >
        <button
          type="button"
          onPointerDown={(e) => controls.start(e)}
          aria-label="Drag to reorder"
          className="focus-ring flex h-8 w-8 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-primary active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onInsert("paragraph")}
          aria-label="Add a block below"
          className="focus-ring flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-primary"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div
        className={cn(
          "rounded-lg border border-transparent px-3 py-2 transition-colors duration-normal",
          (active || held) && "border-border bg-card",
        )}
      >
        {/* The same two controls, in the sheet, below `lg`. Always visible
            rather than revealed on hover: there is no hover on the devices
            this branch exists for, and a control that only appears on a state
            a touch screen cannot enter is a control that is not there. */}
        <div className="mb-1.5 flex items-center gap-0.5 lg:hidden">
          <button
            type="button"
            onPointerDown={(e) => controls.start(e)}
            aria-label="Drag to reorder"
            className="focus-ring tap-square flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-primary active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onInsert("paragraph")}
            aria-label="Add a block below"
            className="focus-ring tap-square flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-primary"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
          <span className="rule-label ml-1.5 truncate">{BLOCK_LABEL[block.type]}</span>
        </div>

        <BlockEditor block={block} onChange={onChange} onFocus={onFocus} onBlur={onBlur} />

        {/* Actions — one row, only while focused. */}
        <AnimatePresence>
          {active && (
            <motion.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={transitions.fast}
              className="overflow-hidden"
            >
              <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-border pt-2">
                <span className="rule-label mr-2">{BLOCK_LABEL[block.type]}</span>

                <label className="inline-flex items-center gap-1.5">
                  <Type className="h-3 w-3 text-muted-foreground" aria-hidden />
                  <select
                    value={block.type}
                    onChange={(e) => onConvert(e.target.value as BlockType)}
                    aria-label="Convert block type"
                    className="focus-ring rounded border border-border bg-background px-1.5 py-1 text-[11px]"
                  >
                    {(Object.keys(BLOCK_LABEL) as BlockType[]).map((type) => (
                      <option key={type} value={type}>
                        {BLOCK_LABEL[type]}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={onDuplicate}
                  className="focus-ring tap inline-flex h-8 items-center gap-1.5 rounded px-2 text-[11px] font-semibold text-muted-foreground hover:bg-secondary hover:text-primary"
                >
                  <Copy className="h-3 w-3" aria-hidden />
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={onRemove}
                  className="focus-ring tap inline-flex h-8 items-center gap-1.5 rounded px-2 text-[11px] font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" aria-hidden />
                  Delete
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reorder.Item>
  );
}

function BlockEditor({
  block,
  onChange,
  onFocus,
  onBlur,
}: {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const shared =
    "w-full resize-none bg-transparent outline-none placeholder:text-muted-foreground/40";

  switch (block.type) {
    case "heading":
      return (
        <input
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="Section heading — becomes an audio chapter"
          className={cn(shared, "font-display text-2xl font-semibold tracking-tight")}
        />
      );

    case "quote":
      return (
        <textarea
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)}
          onFocus={onFocus}
          onBlur={onBlur}
          rows={2}
          placeholder="Pull quote"
          className={cn(shared, "font-display border-l-2 border-accent pl-4 text-xl italic")}
        />
      );

    case "list":
      return (
        <textarea
          value={block.items.join("\n")}
          onChange={(e) =>
            onChange({ items: e.target.value.split("\n") } as unknown as Partial<Block>)
          }
          onFocus={onFocus}
          onBlur={onBlur}
          rows={Math.max(2, block.items.length)}
          placeholder="One item per line"
          className={cn(shared, "text-[15px] leading-relaxed")}
        />
      );

    case "image":
      return (
        <div className="space-y-2">
          <div className="flex h-24 items-center justify-center rounded border border-dashed border-border text-xs text-muted-foreground">
            Image upload isn't wired up yet
          </div>
          <input
            value={block.caption ?? ""}
            onChange={(e) => onChange({ caption: e.target.value } as Partial<Block>)}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="Caption — read aloud with the article"
            className={cn(shared, "text-xs")}
          />
        </div>
      );

    case "divider":
      return <hr className="my-3 border-border" />;

    default:
      return (
        <textarea
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)}
          onFocus={onFocus}
          onBlur={onBlur}
          rows={Math.max(2, Math.ceil(block.text.length / 90))}
          placeholder="Write…"
          className={cn(shared, "text-[15px] leading-[1.75]")}
        />
      );
  }
}
