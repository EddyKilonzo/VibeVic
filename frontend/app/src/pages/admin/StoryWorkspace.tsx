"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
export default function StoryWorkspace() {
  const { id } = useParams();
  const existing = id ? storyById(id) : undefined;
  const reduced = useReducedMotion();

  const [draft, setDraft] = useState<Story>(() =>
    existing ? { ...existing, body: [...existing.body] } : BLANK,
  );
  const [activeBlock, setActiveBlock] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (existing) setDraft({ ...existing, body: [...existing.body] });
  }, [existing]);

  /* Autosave — stands in for the CMS write. */
  const save = useCallback(async (value: Story) => {
    await new Promise((resolve) => setTimeout(resolve, 450));
    // Nothing is persisted yet: the seed content is read-only, so this is the
    // single place a real PUT would go.
    void value;
  }, []);

  const { status, savedAt } = useAutosave(draft, save);

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

  const setStatus = (next: StoryStatus) => {
    setDraft((d) => ({ ...d, status: next }));
    notify.success(
      next === "published" ? "Story published" : next === "scheduled" ? "Story scheduled" : "Moved to drafts",
      draft.title || "Untitled",
    );
  };

  return (
    <div className="mx-auto max-w-[860px] pb-24">
      <Reveal variant="fade-up">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/stories"
            className="focus-ring inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Stories
          </Link>

          <SaveIndicator status={status} savedAt={savedAt} />

          <div className="ml-auto flex items-center gap-2">
            <NarrationPreview draft={draft} />
            {draft.status === "published" ? (
              <Button size="sm" variant="outline" onClick={() => setStatus("draft")}>
                Unpublish
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStatus("published")}>
                Publish
              </Button>
            )}
          </div>
        </div>
      </Reveal>

      {/* Headline and standfirst */}
      <Reveal variant="fade-up" delay={60} className="mt-8">
        <textarea
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="Headline"
          rows={2}
          className="font-display w-full resize-none bg-transparent text-4xl font-semibold leading-tight tracking-tight outline-none placeholder:text-muted-foreground/40"
        />
        <textarea
          value={draft.dek}
          onChange={(e) => setDraft((d) => ({ ...d, dek: e.target.value }))}
          placeholder="Standfirst — one sentence on why this matters."
          rows={2}
          className="mt-4 w-full resize-none bg-transparent text-lg leading-relaxed text-muted-foreground outline-none placeholder:text-muted-foreground/40"
        />

        <div className="mt-5 flex flex-wrap items-center gap-3 border-y border-border py-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            <span className="rule-label">Beat</span>
            <select
              value={draft.genre}
              onChange={(e) => setDraft((d) => ({ ...d, genre: e.target.value }))}
              className="focus-ring rounded border border-border bg-background px-2 py-1 text-xs"
            >
              {GENRES.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <span aria-hidden className="h-3 w-px bg-border" />
          <span>{wordCount} words</span>
          <span aria-hidden className="h-3 w-px bg-border" />
          <span>{draft.body.length} blocks</span>
          <span
            className={cn(
              "ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
              draft.status === "published" ? "bg-accent/12 text-accent" : "bg-muted",
            )}
          >
            {draft.status}
          </span>
        </div>
      </Reveal>

      {/* Blocks */}
      <Reorder.Group
        axis="y"
        values={draft.body}
        onReorder={(body) => setDraft((d) => ({ ...d, body }))}
        className="drag-zone mt-8 space-y-1"
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

  const label =
    status === "saving"
      ? "Saving…"
      : status === "unsaved"
        ? "Unsaved changes"
        : status === "error"
          ? "Couldn't save"
          : savedAt
            ? `Saved ${formatRelative(savedAt.toISOString())}`
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
      className="drag-item group/block relative rounded-md"
      data-dragging={held || undefined}
    >
      {/* Gutter controls — invisible until this block is touched. */}
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
          className="focus-ring flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-primary"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div
        className={cn(
          "rounded-md border border-transparent px-3 py-2 transition-colors duration-normal",
          (active || held) && "border-border bg-card",
        )}
      >
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
                  className="focus-ring inline-flex h-8 items-center gap-1.5 rounded px-2 text-[11px] font-semibold text-muted-foreground hover:bg-secondary hover:text-primary"
                >
                  <Copy className="h-3 w-3" aria-hidden />
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={onRemove}
                  className="focus-ring inline-flex h-8 items-center gap-1.5 rounded px-2 text-[11px] font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
