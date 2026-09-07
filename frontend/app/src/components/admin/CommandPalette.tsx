"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CornerDownLeft, FilePen, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";
import { newsroomPath } from "@/lib/newsroom-path";

/**
 * ⌘K — go anywhere, open anything.
 *
 * ── Why a newsroom of fourteen screens needs one ─────────────────────────
 * The rail is grouped now, which fixes scanning, and it still costs a look
 * away from the work, a movement across the screen and a click for every
 * move. That is the right price for a screen somebody visits twice a week. It
 * is the wrong price for a tool one person is inside all day, where the same
 * six or seven moves are made over and over — open that draft, check what is
 * due, go back to the piece.
 *
 * The other half is drafts. The rail can offer "Stories"; it cannot offer
 * *this* story, and the piece being worked on is the single most common
 * destination in the whole application. Reaching it currently means Stories,
 * then find the row, then click. Here it is three letters of the headline.
 *
 * ── What it deliberately does not do ─────────────────────────────────────
 * It navigates and it creates a blank draft. It does not delete, publish,
 * send, or change a record — nothing behind this palette is irreversible.
 * A command surface is a place where things are chosen quickly and half-read,
 * which is an argument for keeping the destructive verbs where they are, next
 * to the thing they affect and the confirmation that guards them.
 *
 * ── The ⌘K it does not steal ─────────────────────────────────────────────
 * The editor already binds ⌘K, on the field, to wrap a selection in a link.
 * That handler runs first — React's root listener sits below `window` — and
 * calls `preventDefault`, so the check below leaves it alone. With the caret
 * in a paragraph ⌘K makes a link; anywhere else it opens this. Neither had to
 * learn about the other beyond that one line.
 */

interface Destination {
  id: string;
  label: string;
  /** The group heading, or the piece's status. Shown right-aligned, quietly. */
  hint: string;
  href: string;
}

export interface PaletteSection {
  href: string;
  label: string;
  group: string;
}

/** What the stories proxy gives back, narrowed to what a row needs. */
interface StoryRow {
  id: string;
  title: string;
  status?: string;
}

export function CommandPalette({ sections }: { sections: PaletteSection[] }) {
  const router = useRouter();
  const reduced = useReducedMotion();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [stories, setStories] = useState<StoryRow[] | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  /* ── Opening ────────────────────────────────────────────────────────── */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        setOpen(false);
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      // The editor's link shortcut got here first. See the note above.
      if (event.defaultPrevented) return;
      event.preventDefault();
      setOpen((was) => !was);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // A fresh query every time it opens. Reopening onto the last search is the
  // behaviour that makes people delete a word before they can type one.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    inputRef.current?.focus();
  }, [open]);

  /*
   * Drafts are fetched once, on the first open, and then kept.
   *
   * Not on mount: this component is in the layout, so that would put a request
   * on every newsroom page load to populate a list most of them never show.
   * Not on every open either — the list is a few dozen rows and a stale
   * headline for the length of one session is a smaller cost than a request
   * per keystroke-of-thought. A failure is silent and simply leaves the
   * palette with its destinations, which is still most of what it is for.
   */
  useEffect(() => {
    if (!open || stories !== null) return;
    let cancelled = false;

    fetch("/api/newsroom/stories", { headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : []))
      .then((rows: unknown) => {
        if (cancelled) return;
        setStories(Array.isArray(rows) ? (rows as StoryRow[]) : []);
      })
      .catch(() => {
        if (!cancelled) setStories([]);
      });

    return () => {
      cancelled = true;
    };
  }, [open, stories]);

  /* ── What is in the list ────────────────────────────────────────────── */

  const everything = useMemo<Destination[]>(() => {
    const screens: Destination[] = sections.map((section) => ({
      id: `screen:${section.href}`,
      label: section.label,
      hint: section.group,
      href: section.href,
    }));

    const drafts: Destination[] = (stories ?? []).map((story) => ({
      id: `story:${story.id}`,
      // An untitled draft is findable by the word "untitled", which is what
      // somebody actually types when looking for the one they have not named.
      label: story.title?.trim() || "Untitled draft",
      hint: (story.status ?? "draft").toLowerCase(),
      href: newsroomPath(`/stories/${story.id}`),
    }));

    return [
      { id: "new", label: "New story", hint: "write", href: newsroomPath("/stories/new") },
      ...screens,
      ...drafts,
    ];
  }, [sections, stories]);

  /*
   * Substring matching, not fuzzy.
   *
   * A fuzzy matcher scores every candidate and reorders on each keystroke, so
   * the row under the cursor moves while you are still typing towards it —
   * which is how a command palette gets you to the wrong place quickly. Plain
   * case-insensitive containment keeps the order stable and predictable: the
   * screens are always in rail order and the drafts always in the order the
   * newsroom lists them.
   */
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return everything.slice(0, 12);
    return everything
      .filter((item) => item.label.toLowerCase().includes(needle))
      .slice(0, 12);
  }, [everything, query]);

  // The cursor is clamped rather than reset, so narrowing a search by one
  // letter does not throw the selection back to the top of the list.
  const active = Math.min(cursor, Math.max(0, results.length - 1));

  const go = useCallback(
    (destination: Destination | undefined) => {
      if (!destination) return;
      setOpen(false);
      router.push(destination.href);
    },
    [router],
  );

  /* ── Keeping the highlighted row in view ────────────────────────────── */

  useEffect(() => {
    const list = listRef.current;
    const row = list?.children[active] as HTMLElement | undefined;
    row?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduced ? { duration: 0 } : transitions.fast}
          className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
        >
          {/* Clicking away closes it. A palette is a glance, not a form —
              there is nothing here to lose by dismissing it. */}
          <div
            className="absolute inset-0 bg-brand-ink/40 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Go to"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            transition={reduced ? { duration: 0 } : transitions.normal}
            className="surface relative w-full max-w-xl overflow-hidden p-0 shadow-deep"
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCursor(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setCursor((c) => Math.min(c + 1, results.length - 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setCursor((c) => Math.max(c - 1, 0));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    go(results[active]);
                  }
                }}
                role="combobox"
                aria-expanded
                aria-controls="palette-results"
                aria-activedescendant={results[active] ? `palette-${results[active].id}` : undefined}
                placeholder="Go to a screen, or open a piece by its headline"
                className="h-14 w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
              />
            </div>

            {results.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nothing here matches that.
              </p>
            ) : (
              <ul
                ref={listRef}
                id="palette-results"
                role="listbox"
                aria-label="Results"
                className="max-h-[46vh] overflow-y-auto py-2"
              >
                {results.map((item, index) => (
                  <li
                    key={item.id}
                    id={`palette-${item.id}`}
                    role="option"
                    aria-selected={index === active}
                    // Hover moves the cursor rather than painting a second
                    // highlight, so the keyboard and the mouse never disagree
                    // about which row Enter would open.
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => go(item)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm",
                      index === active ? "bg-secondary text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <FilePen
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        index === active ? "text-primary" : "opacity-50",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <span className="shrink-0 text-[11px] uppercase tracking-wider opacity-60">
                      {item.hint}
                    </span>
                    {index === active && (
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
