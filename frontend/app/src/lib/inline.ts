/**
 * Inline emphasis.
 *
 * ── Why markers in the string and not a rich-text model ──────────────────
 * A block stores `text: string`. Bold and italic could have been a tree of
 * styled runs instead, but that changes the shape of every block, every
 * import, the draft written to storage, and the narration extractor — and it
 * buys a `contentEditable` surface, which is the single most bug-prone thing
 * a person can put in a web page. Selection, undo, paste, IME composition and
 * mobile keyboards all become yours to own.
 *
 * The markers are the ones a journalist already types. `**bold**` survives
 * copy-paste into any other tool, reads correctly in the raw string, and
 * costs one parse at render.
 *
 * ── Deliberately not a Markdown implementation ───────────────────────────
 * No code spans, no images, no reference links, no nesting beyond one level.
 * Every extra construct is another way for a stray asterisk in someone's
 * prose to come out as markup they did not ask for. An unmatched marker stays
 * literal.
 *
 * Links are the one construct that earned its place. A journalist citing a
 * source, a court filing or the piece a story is responding to cannot do it
 * in prose alone — "see the Gazette notice" with no way to reach the Gazette
 * notice is the reporting equivalent of a dead end — and `[text](url)` is
 * both what they already type and what survives a paste into anything else.
 * Emphasis inside a link label works; a link inside emphasis does not, which
 * is the one level of nesting this needs.
 */

export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Set on every run inside a link label. Already vetted by `safeHref`. */
  href?: string;
}

/**
 * `[label](url)`. The URL may not contain a space or a closing bracket, which
 * is what stops a missing `)` from swallowing the rest of the paragraph.
 */
const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

/**
 * The URLs a link is allowed to point at.
 *
 * An allow-list, not a block-list. Article text is authored in a workspace
 * and rendered into everyone's browser, so the question is not "is this one
 * of the bad schemes" — it is "is this one of the four things a citation can
 * legitimately be". `javascript:` and `data:` fail that test without having
 * to be named, and so does anything invented later.
 *
 * Protocol-relative `//host` is refused too: it reads as a path and behaves
 * as an off-site link, and that gap is exactly where a reader gets sent
 * somewhere the writer did not intend.
 */
export function safeHref(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (/^mailto:[^\s@]+@[^\s@]+/i.test(url)) return url;
  if (/^[/#][^/]/.test(url) || url === "/") return url;
  return null;
}

/** True for a link that leaves the site, which is the pair that needs `rel`. */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/**
 * `***both***`, `**bold**`, `*italic*`, `_italic_`.
 *
 * Ordered longest-first so `**` is never matched as two `*`. The inner group
 * forbids its own delimiter, which is what keeps a run from swallowing the
 * rest of the paragraph when a closer is missing.
 */
const EMPHASIS = /\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*\n]+)\*|_([^_\n]+)_/g;

export function parseInline(input: string): InlineRun[] {
  if (!input) return [];
  // Fast path. Most paragraphs contain no markers at all, and allocating a
  // run array for every one of them is work on the reading path.
  if (!input.includes("*") && !input.includes("_") && !input.includes("[")) {
    return [{ text: input }];
  }

  // Links are matched before emphasis and their labels are parsed for it,
  // rather than the other way round: a URL is full of characters emphasis
  // cares about, and `*` inside a query string is not italics.
  const runs: InlineRun[] = [];
  let cursor = 0;

  LINK.lastIndex = 0;
  for (let match = LINK.exec(input); match; match = LINK.exec(input)) {
    const href = safeHref(match[2]);
    // An unusable URL leaves the source text exactly as written. Silently
    // rendering `[see here](javascript:…)` as plain prose is right; silently
    // rendering it as a link is not.
    if (!href) continue;

    if (match.index > cursor) runs.push(...emphasisRuns(input.slice(cursor, match.index)));
    for (const run of emphasisRuns(match[1])) runs.push({ ...run, href });
    cursor = match.index + match[0].length;
  }

  if (cursor < input.length) runs.push(...emphasisRuns(input.slice(cursor)));
  return runs.length > 0 ? runs : [{ text: input }];
}

function emphasisRuns(input: string): InlineRun[] {
  if (!input) return [];
  if (!input.includes("*") && !input.includes("_")) return [{ text: input }];

  const runs: InlineRun[] = [];
  let last = 0;

  EMPHASIS.lastIndex = 0;
  for (let match = EMPHASIS.exec(input); match; match = EMPHASIS.exec(input)) {
    if (match.index > last) runs.push({ text: input.slice(last, match.index) });

    const [, both, bold, star, underscore] = match;
    if (both !== undefined) runs.push({ text: both, bold: true, italic: true });
    else if (bold !== undefined) runs.push({ text: bold, bold: true });
    else if (star !== undefined) runs.push({ text: star, italic: true });
    else if (underscore !== undefined) runs.push({ text: underscore, italic: true });

    last = match.index + match[0].length;
  }

  if (last < input.length) runs.push({ text: input.slice(last) });
  return runs.length > 0 ? runs : [{ text: input }];
}

/**
 * The same text with the markers removed.
 *
 * Anything that is not rendering — speech, reading-time estimates, meta
 * descriptions, search — wants this. A narrator reading "asterisk asterisk"
 * aloud is the loudest possible version of this bug.
 */
export function stripInline(input: string): string {
  if (!input || (!input.includes("*") && !input.includes("_") && !input.includes("["))) {
    return input;
  }
  return parseInline(input)
    .map((run) => run.text)
    .join("");
}

/** Whether a string carries any emphasis at all. */
export function hasInline(input: string): boolean {
  return stripInline(input) !== input;
}

export type EmphasisKind = "bold" | "italic";

const MARK: Record<EmphasisKind, string> = { bold: "**", italic: "*" };

export interface ToggleResult {
  text: string;
  /** Where the selection should sit afterwards. */
  start: number;
  end: number;
}

/**
 * Wraps or unwraps a selection.
 *
 * Toggling, not just wrapping: pressing ⌘B twice should leave the sentence as
 * it was found, and a writer who selects an already-bold phrase and presses
 * ⌘B means "stop shouting". The unwrap checks just outside the selection too,
 * because double-clicking a bold word selects the word and not its markers.
 *
 * With no selection it inserts the pair and puts the caret between them, so
 * ⌘B then typing does what it does in every other editor.
 */
export function toggleEmphasis(
  text: string,
  start: number,
  end: number,
  kind: EmphasisKind,
): ToggleResult {
  const mark = MARK[kind];
  const width = mark.length;

  if (start === end) {
    return {
      text: `${text.slice(0, start)}${mark}${mark}${text.slice(start)}`,
      start: start + width,
      end: start + width,
    };
  }

  const selected = text.slice(start, end);

  /**
   * Whether a run of `n` asterisks means this kind is already applied.
   *
   * Asterisk counts are positional, not a set of flags, so a naive
   * "starts and ends with the mark" test gets two cases backwards. Two stars
   * is bold *without* italic, so italic must add rather than remove — and
   * three is both, so italic must remove one and leave `**bold**` standing.
   * Bold is the simpler half: two or more stars on each side means there is a
   * bold pair to take away.
   */
  const applied = (n: number) => (kind === "bold" ? n >= 2 : n % 2 === 1);

  const runAt = (source: string, from: number, step: 1 | -1) => {
    let n = 0;
    for (let i = from; i >= 0 && i < source.length && source[i] === "*"; i += step) n += 1;
    return n;
  };

  // Already wrapped inside the selection: **like this**
  const leadStars = runAt(selected, 0, 1);
  const tailStars = runAt(selected, selected.length - 1, -1);
  if (
    selected.length > width * 2 &&
    applied(leadStars) &&
    applied(tailStars) &&
    leadStars + tailStars < selected.length
  ) {
    const inner = selected.slice(width, -width);
    return {
      text: text.slice(0, start) + inner + text.slice(end),
      start,
      end: start + inner.length,
    };
  }

  // `_like this_` — the underscore form only ever comes from typing, and the
  // toggle emits stars, so without this an italic press on it nests rather
  // than releases.
  if (
    kind === "italic" &&
    selected.length > 2 &&
    selected.startsWith("_") &&
    selected.endsWith("_")
  ) {
    const inner = selected.slice(1, -1);
    return {
      text: text.slice(0, start) + inner + text.slice(end),
      start,
      end: start + inner.length,
    };
  }

  // Wrapped just outside it: **|like this|**
  const beforeStars = runAt(text, start - 1, -1);
  const afterStars = runAt(text, end, 1);
  if (applied(beforeStars) && applied(afterStars)) {
    return {
      text: text.slice(0, start - width) + selected + text.slice(end + width),
      start: start - width,
      end: end - width,
    };
  }

  // Whitespace stays outside the markers.
  //
  // Double-clicking a word selects the trailing space in every browser, so
  // without this the overwhelmingly common gesture produces `**word **next`
  // — a bold space, and a marker sitting against the following word where a
  // later edit can trap it. Emphasising a run of pure whitespace is a no-op
  // for the same reason.
  const lead = selected.length - selected.trimStart().length;
  const trail = selected.length - selected.trimEnd().length;
  const core = selected.slice(lead, selected.length - trail);
  // Nothing to emphasise: empty, whitespace, or a selection that is only
  // markers already — wrapping `**` would give `******`, which is not what
  // anybody meant by pressing the button.
  if (!core || /^[*_]+$/.test(core)) return { text, start, end };

  const from = start + lead;
  const to = end - trail;

  return {
    text: `${text.slice(0, from)}${mark}${core}${mark}${text.slice(to)}`,
    start: from + width,
    end: to + width,
  };
}

/**
 * Wraps a selection in a link, or drops a new one at the caret.
 *
 * Returns the same shape as `toggleEmphasis` so the editor's selection
 * restoration works identically for both — the textarea is re-rendered by
 * React either way, and the caret has to be put back by hand.
 *
 * With no selection there is nothing to label, so the URL becomes its own
 * label and the whole label is selected: the writer types over it if they
 * want words instead, which is one keystroke fewer than deleting a
 * placeholder somebody chose for them.
 */
export function wrapLink(
  text: string,
  start: number,
  end: number,
  url: string,
): ToggleResult | null {
  const href = safeHref(url);
  if (!href) return null;

  const label = start === end ? href : text.slice(start, end);
  const inserted = `[${label}](${href})`;

  return {
    text: `${text.slice(0, start)}${inserted}${text.slice(end)}`,
    // Selection lands on the label, never on the markup: the label is the
    // part a writer edits after the fact and the URL is the part they do not.
    start: start + 1,
    end: start + 1 + label.length,
  };
}

/** The link surrounding a caret position, if it is inside one. */
export function linkAt(text: string, position: number): { start: number; end: number; href: string } | null {
  LINK.lastIndex = 0;
  for (let match = LINK.exec(text); match; match = LINK.exec(text)) {
    const start = match.index;
    const end = start + match[0].length;
    if (position >= start && position <= end) {
      const href = safeHref(match[2]);
      if (href) return { start, end, href };
    }
  }
  return null;
}

/** Removes the link around a position, keeping its label. */
export function unlinkAt(text: string, position: number): ToggleResult | null {
  const found = linkAt(text, position);
  if (!found) return null;
  const match = text.slice(found.start, found.end).match(/^\[([^\]\n]+)\]/);
  const label = match ? match[1] : "";
  return {
    text: `${text.slice(0, found.start)}${label}${text.slice(found.end)}`,
    start: found.start,
    end: found.start + label.length,
  };
}
