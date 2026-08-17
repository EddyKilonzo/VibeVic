"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  Bold,
  Check,
  Cloud,
  Italic,
  Copy,
  GripVertical,
  Heading2,
  Headphones,
  ImagePlus,
  List as ListIcon,
  Minus,
  Pause,
  Pilcrow,
  Plus,
  Quote,
  Trash2,
  Type,
} from "lucide-react";
import type { Block, BlockType, Genre, Story, StoryStatus } from "@/data/types";
import { GENRES, storyById } from "@/data/content";
import { cn } from "@/lib/utils";
import { stagger, transitions } from "@/lib/motion";
import { formatRelative } from "@/lib/format";
import { notify } from "@/lib/toast";
import { useAutosave, type SaveStatus } from "@/hooks/useAutosave";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { readDraft, writeDraft, type StoredDraft } from "@/lib/drafts";
import { addUpload, listMedia, srcFor } from "@/lib/media";
import { allBeats } from "@/lib/beats";
import { toggleEmphasis, type EmphasisKind } from "@/lib/inline";
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
  const [beats, setBeats] = useState<Genre[]>(GENRES);

  /**
   * Which face the draft is composed in.
   *
   * This is a preview, and the control says so. The site sets the published
   * face in `.article-body`; nothing here writes a font onto the story,
   * because the renderer does not read one and a control that quietly did
   * nothing would be worse than no control.
   *
   * What it is genuinely for: the editor used to compose paragraphs in Inter
   * while the site publishes them in Fraunces, so a writer judging rhythm,
   * line breaks and how a long name sits was looking at the wrong text in the
   * wrong face. It now opens in the published face, and flips to the sans for
   * comparison.
   */
  const [face, setFace] = useLocalStorage<"display" | "sans">(
    "vv:workspace-face",
    "display",
  );
  const faceClass = face === "sans" ? "font-sans" : "font-display";

  const pickUpDraft = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      setStored(readDraft(targetId));
      setRestoreOffer(true);
      // Same pass, same reason: both stores are read once the sheet is up
      // rather than during render, which this prerendered route would hydrate
      // against a different answer.
      setBeats(allBeats());
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
          className={cn(
            faceClass,
            "display-2 w-full resize-none bg-transparent font-semibold outline-none placeholder:text-muted-foreground/30",
          )}
        />
        <textarea
          value={draft.dek}
          onChange={(e) => setDraft((d) => ({ ...d, dek: e.target.value }))}
          placeholder="Standfirst — one sentence on why this matters."
          rows={2}
          className={cn(
            faceClass,
            "lead-copy mt-5 w-full resize-none bg-transparent text-muted-foreground outline-none placeholder:text-muted-foreground/30",
          )}
        />

        <div className="mt-5 flex flex-wrap items-center gap-3 border-y border-border py-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            <span className="rule-label">Beat</span>
            <select
              value={draft.genre}
              onChange={(e) => setDraft((d) => ({ ...d, genre: e.target.value }))}
              className="focus-ring tap rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              {/* Beats opened in the workspace are listed here too — a beat
                  you cannot file anything under is a beat you did not open. */}
              {beats.map((g) => (
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

          <span aria-hidden className="h-3 w-px bg-border" />
          {/* A preview, and labelled as one. The site decides the published
              face; this is here so the rhythm and the line breaks a writer is
              judging are the ones the reader will get. */}
          <label className="flex items-center gap-2">
            <span className="rule-label">Set in</span>
            <span
              role="group"
              aria-label="Preview typeface"
              className="surface-compact flex items-center gap-0.5 p-0.5"
            >
              {(
                [
                  { id: "display", label: "Fraunces", cls: "font-display" },
                  { id: "sans", label: "Inter", cls: "font-sans" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFace(option.id)}
                  aria-pressed={face === option.id}
                  title={
                    option.id === "display"
                      ? "Fraunces — the face the site publishes in"
                      : "Inter — the sans, for comparison"
                  }
                  className={cn(
                    option.cls,
                    "focus-ring relative inline-flex h-6 items-center rounded px-2 text-[11px] font-semibold transition-colors duration-normal",
                    face === option.id
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-primary",
                  )}
                >
                  {face === option.id && (
                    <motion.span
                      layoutId={reduced ? undefined : "workspace-face-pill"}
                      className="absolute inset-0 rounded bg-primary"
                      transition={transitions.normal}
                    />
                  )}
                  <span className="relative">{option.label}</span>
                </button>
              ))}
            </span>
          </label>
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
            faceClass={faceClass}
          />
        ))}
      </Reorder.Group>

      {/* The control a writer reaches at the end of the paragraph they just
          finished. It appended a paragraph and nothing else, so carrying on
          with a picture meant going back up to the gutter of the block above.
          Same six choices as the gutter menu, laid out as a row because there
          is width here and a menu would be one click for no reason. */}
      <div className="mt-4 rounded-lg border border-dashed border-border p-2">
        <div className="flex flex-wrap items-center gap-1">
          <span className="rule-label px-2">Continue with</span>
          {INSERT_ORDER.map((type) => {
            const Icon = INSERT_ICON[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, body: [...d.body, emptyBlock(type)] }))}
                className="focus-ring tap group inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground transition-colors duration-normal hover:bg-secondary hover:text-primary"
              >
                <Icon className="icon-pop h-3.5 w-3.5" aria-hidden />
                {BLOCK_LABEL[type]}
              </button>
            );
          })}
        </div>
      </div>
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
  /** `font-display` or `font-sans` — the workspace's preview face. */
  faceClass: string;
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
  faceClass,
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
        <InsertMenu onInsert={onInsert} />
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
          <InsertMenu onInsert={onInsert} />
          <span className="rule-label ml-1.5 truncate">{BLOCK_LABEL[block.type]}</span>
        </div>

        <BlockEditor
          block={block}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          faceClass={faceClass}
          active={active}
        />

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

/**
 * "Add a block here" — and *which* block.
 *
 * The `+` used to insert a paragraph, full stop. Putting a picture between
 * two paragraphs therefore meant: add a paragraph, focus it, find the type
 * dropdown in the row that appears underneath, change it to Image. Four steps
 * and a dropdown to do the second most common thing anyone does while writing
 * a piece.
 *
 * The menu lists the block types directly, so the picture goes where the
 * writer is pointing. Paragraph stays first because it is still the common
 * case, and Image second because it is the one this menu exists for.
 */
const INSERT_ORDER: BlockType[] = ["paragraph", "image", "heading", "quote", "list", "divider"];

const INSERT_ICON: Record<BlockType, typeof Plus> = {
  paragraph: Pilcrow,
  image: ImagePlus,
  heading: Heading2,
  quote: Quote,
  list: ListIcon,
  divider: Minus,
};

function InsertMenu({ onInsert }: { onInsert: (type: BlockType) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // Pointer-down rather than click, so the menu is gone before whatever was
  // pressed underneath it reacts; Escape because a menu you can only leave
  // with a mouse is a trap for anyone using the keyboard.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Add a block below"
        aria-expanded={open}
        aria-haspopup="menu"
        className="focus-ring tap-square flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary aria-expanded:bg-secondary aria-expanded:text-primary"
      >
        <Plus
          className={cn("h-4 w-4 transition-transform duration-normal", open && "rotate-45")}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Block type"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
            transition={transitions.fast}
            className="surface-compact absolute left-0 top-9 z-20 w-[168px] origin-top-left overflow-hidden p-1 shadow-lifted"
          >
            {INSERT_ORDER.map((type) => {
              const Icon = INSERT_ICON[type];
              return (
                <button
                  key={type}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onInsert(type);
                    setOpen(false);
                  }}
                  className="focus-ring group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                >
                  <Icon className="icon-pop h-3.5 w-3.5 shrink-0" aria-hidden />
                  {BLOCK_LABEL[type]}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * The picture on an image block: from the device, or from a link.
 *
 * The block stores a plain string in `src`, which is all a block needs to
 * know — a media id for something in the library, or an absolute URL for
 * something already online. Resolving an id to bytes is the library's job,
 * and keeping the blob out of the draft matters: a draft is `JSON.stringify`d
 * into `localStorage`, and a photograph in there would blow the origin quota
 * and take every other draft with it.
 */
function ImageBlockPicker({
  block,
  onChange,
}: {
  block: Extract<Block, { type: "image" }>;
  onChange: (patch: Partial<Block>) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Resolve whatever `src` holds. An absolute URL is itself; anything else is
  // a library id, and a missing one is reported rather than left as a blank
  // frame the writer will assume is still loading.
  useEffect(() => {
    let revoke: string | null = null;
    let live = true;

    const resolve = async () => {
      const value = block.src;
      if (!value || value === block.id) {
        setPreview(null);
        return;
      }
      if (/^https?:\/\//.test(value)) {
        setPreview(value);
        return;
      }
      const found = (await listMedia()).find((m) => m.id === value);
      if (!live) return;
      if (!found) {
        setPreview(null);
        setProblem("That picture is no longer in the media library.");
        return;
      }
      const url = srcFor(found);
      if (found.source === "upload") revoke = url;
      setPreview(url);
    };

    void resolve();
    return () => {
      live = false;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [block.src, block.id]);

  const take = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setProblem(null);
    try {
      const item = await addUpload(file);
      onChange({ src: item.id } as Partial<Block>);
    } catch (cause) {
      setProblem(cause instanceof Error ? cause.message : "That file could not be added.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="relative overflow-hidden rounded-lg border border-border">
          {/* Blob and arbitrary remote URLs — no optimiser route, no
              `remotePatterns` entry. */}
          <img src={preview} alt="" className="max-h-72 w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange({ src: block.id } as Partial<Block>)}
            className="focus-ring absolute right-2 top-2 rounded-md bg-background/90 px-2.5 py-1 text-[11px] font-semibold shadow-raised backdrop-blur transition-colors hover:text-primary"
          >
            Replace
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={input}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                void take(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="focus-ring group inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-xs font-semibold transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              <ImagePlus className="icon-pop h-3.5 w-3.5" aria-hidden />
              {busy ? "Adding…" : "From this device"}
            </button>

            <label className="inline-flex min-w-0 flex-1 items-center gap-2">
              <span className="sr-only">Image address</span>
              <input
                type="url"
                defaultValue={/^https?:\/\//.test(block.src) ? block.src : ""}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value && /^https?:\/\//.test(value)) {
                    onChange({ src: value } as Partial<Block>);
                    setProblem(null);
                  } else if (value) {
                    setProblem("Links must start with http:// or https://");
                  }
                }}
                placeholder="…or paste a link"
                className="focus-ring h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 text-xs outline-none transition-colors focus:border-accent"
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            On a phone the picker offers the camera as well as your photos.
          </p>
        </div>
      )}

      {problem && (
        <p role="alert" className="text-[11px] text-destructive">
          {problem}
        </p>
      )}
    </div>
  );
}

/**
 * Bold and italic on a plain `<textarea>`.
 *
 * The shortcut is the whole feature: a writer who wants a word emphasised
 * presses ⌘B, they do not go looking for a button. The buttons exist for
 * discoverability and for anyone who cannot hold two keys, and both routes
 * run the same `toggleEmphasis`.
 *
 * The selection is restored by hand after the change. React re-renders the
 * textarea from `value`, which resets the caret to the end — so a writer who
 * emphasised a word in the middle of a paragraph would be thrown to the
 * bottom of it on every press. `setSelectionRange` in a layout effect puts
 * them back before the browser paints.
 */
function useEmphasis(
  value: string,
  commit: (next: string) => void,
): {
  ref: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  apply: (kind: EmphasisKind) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
} {
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const pending = useRef<[number, number] | null>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !pending.current) return;
    const [start, end] = pending.current;
    pending.current = null;
    node.focus();
    node.setSelectionRange(start, end);
  });

  const apply = useCallback(
    (kind: EmphasisKind) => {
      const node = ref.current;
      if (!node) return;
      const start = node.selectionStart ?? value.length;
      const end = node.selectionEnd ?? start;
      const result = toggleEmphasis(value, start, end, kind);
      pending.current = [result.start, result.end];
      commit(result.text);
    },
    [value, commit],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key !== "b" && key !== "i") return;
      event.preventDefault();
      apply(key === "b" ? "bold" : "italic");
    },
    [apply],
  );

  return { ref, apply, onKeyDown };
}

/** The B / I pair shown on the focused block. */
function EmphasisButtons({ apply }: { apply: (kind: EmphasisKind) => void }) {
  return (
    <>
      {(
        [
          { kind: "bold" as const, Icon: Bold, label: "Bold", hint: "Ctrl/⌘ B" },
          { kind: "italic" as const, Icon: Italic, label: "Italic", hint: "Ctrl/⌘ I" },
        ]
      ).map(({ kind, Icon, label, hint }) => (
        <button
          key={kind}
          type="button"
          // Pointer-down, not click: a click fires after blur, and by then the
          // textarea has lost the selection this is meant to wrap.
          onMouseDown={(e) => {
            e.preventDefault();
            apply(kind);
          }}
          aria-label={`${label} (${hint})`}
          title={`${label} — ${hint}`}
          className="focus-ring tap inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </button>
      ))}
    </>
  );
}

function BlockEditor({
  block,
  onChange,
  onFocus,
  onBlur,
  faceClass,
  active,
}: {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
  onFocus: () => void;
  onBlur: () => void;
  faceClass: string;
  /** Shows the emphasis controls only on the block being written in. */
  active: boolean;
}) {
  // The face rides on `shared`, so every text surface in the editor —
  // paragraphs included — shows the piece in the same one. Paragraphs used to
  // be left at the body sans while the site publishes them in the serif, which
  // meant a writer judging a line break was judging the wrong line.
  const shared = cn(
    faceClass,
    "w-full resize-none bg-transparent outline-none placeholder:text-muted-foreground/40",
  );

  switch (block.type) {
    case "heading":
      return (
        <input
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value } as Partial<Block>)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="Section heading — becomes an audio chapter"
          className={cn(shared, "text-2xl font-semibold tracking-tight")}
        />
      );

    case "quote":
      return (
        <EmphasisField
          value={block.text}
          onChange={(text) => onChange({ text } as Partial<Block>)}
          onFocus={onFocus}
          onBlur={onBlur}
          active={active}
          rows={2}
          placeholder="Pull quote"
          className={cn(shared, "border-l-2 border-accent pl-4 text-xl italic")}
        />
      );

    case "list":
      return (
        <EmphasisField
          value={block.items.join("\n")}
          onChange={(text) =>
            onChange({ items: text.split("\n") } as unknown as Partial<Block>)
          }
          onFocus={onFocus}
          onBlur={onBlur}
          active={active}
          rows={Math.max(2, block.items.length)}
          placeholder="One item per line"
          className={cn(shared, "text-[15px] leading-relaxed")}
        />
      );

    case "image":
      return (
        <div className="space-y-2">
          <ImageBlockPicker block={block} onChange={onChange} />
          <input
            value={block.caption ?? ""}
            onChange={(e) => onChange({ caption: e.target.value } as Partial<Block>)}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="Caption — read aloud with the article"
            className={cn(shared, "text-xs")}
          />
          <input
            value={block.alt ?? ""}
            onChange={(e) => onChange({ alt: e.target.value } as Partial<Block>)}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="Alt text — what the picture shows, for anyone who cannot see it"
            className={cn(shared, "text-xs")}
          />
        </div>
      );

    case "divider":
      return <hr className="my-3 border-border" />;

    default:
      return (
        <EmphasisField
          value={block.text}
          onChange={(text) => onChange({ text } as Partial<Block>)}
          onFocus={onFocus}
          onBlur={onBlur}
          active={active}
          rows={Math.max(2, Math.ceil(block.text.length / 90))}
          placeholder="Write…"
          className={cn(shared, "text-[15px] leading-[1.75]")}
        />
      );
  }
}

/**
 * A textarea that can be emphasised.
 *
 * The toolbar sits under the field rather than floating over the selection.
 * A floating bar has to be positioned from the selection rectangle, which
 * means measuring it on every keystroke and fighting the caret on mobile,
 * where the OS puts its own bar in the same place. Under the field it is
 * always in the same spot and never covers the words.
 */
function EmphasisField({
  value,
  onChange,
  onFocus,
  onBlur,
  active,
  rows,
  placeholder,
  className,
}: {
  value: string;
  onChange: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  active: boolean;
  rows: number;
  placeholder: string;
  className: string;
}) {
  const { ref, apply, onKeyDown } = useEmphasis(value, onChange);

  return (
    <div>
      <textarea
        ref={ref as React.RefObject<HTMLTextAreaElement>}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        rows={rows}
        placeholder={placeholder}
        className={className}
      />
      {active && (
        <div className="-ml-1.5 flex items-center gap-0.5">
          <EmphasisButtons apply={apply} />
          <span className="ml-1 text-[10px] text-muted-foreground">
            **bold** · *italic*
          </span>
        </div>
      )}
    </div>
  );
}
