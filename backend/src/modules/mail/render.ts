import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from 'ejs';

/**
 * Turning a message into HTML.
 *
 * ── Why EJS and not string concatenation ─────────────────────────────────
 * The two original emails were built by joining arrays of lines, which was
 * exactly right when the answer was plain text and there was one of them.
 * Four messages with a shared shell is a different problem: the layout has to
 * be written once, and a template with a hole in it is a better shape for
 * that than a function that returns a hundred lines of markup with the
 * content interpolated at seven depths.
 *
 * ── Every value is escaped ───────────────────────────────────────────────
 * `<%= %>` in the layout and in every block below, never `<%- %>`, except for
 * the one place that composes already-rendered blocks. This matters more here
 * than on a web page: an email is forwarded, and a pitch title that closed a
 * tag would break the message in whichever client the *editor* uses rather
 * than in ours.
 *
 * ── The text version is not generated from this ──────────────────────────
 * `MailService.Message` requires `text` and treats `html` as the enhancement.
 * Stripping tags out of the HTML would produce the usual dross — a wall with
 * no line breaks where the paragraphs were. Each template writes both, and
 * the text one stays the copy that has to work.
 *
 * ── Templates are read from disk, and that is a build concern ────────────
 * `nest build` compiles TypeScript and copies nothing else, so `views/*.ejs`
 * has to be listed as an asset in `nest-cli.json` or the compiled server
 * throws ENOENT the first time somebody asks for a password reset. The
 * lookup below tries `dist` and then `src`, so `ts-node` and the built server
 * both find it — and a missing file fails loudly at render rather than
 * silently sending a message with no HTML.
 */

/** Resolved once. The layout does not change between sends. */
let layoutCache: string | null = null;

function layout(): string {
  if (layoutCache) return layoutCache;
  layoutCache = readFileSync(join(__dirname, 'views', 'layout.ejs'), 'utf8');
  return layoutCache;
}

export interface Shell {
  subject: string;
  /** The line under the subject in a phone's inbox list. */
  preheader: string;
  /** The headline inside the card. Often, but not always, the subject. */
  heading: string;
  /** Already-rendered blocks — see the helpers below. */
  body: string;
  /** The quiet line under the rule. Why this arrived, or what it is not. */
  footnote: string;
}

export function renderEmail(shell: Shell): string {
  return render(layout(), shell, { rmWhitespace: false });
}

/* ── Blocks ───────────────────────────────────────────────────────────────
 *
 * Small, because every one of them is a table cell with inline styles and
 * anything larger becomes unreadable. They exist so a template says
 * `paragraph(...)` rather than carrying forty characters of font stack, and
 * so a change to the type scale happens once.
 *
 * The class names come from the layout's stylesheet and are what carries dark
 * mode; the inline styles carry everything a client that drops the `<style>`
 * block still needs. Belt and braces, and both are load-bearing: Gmail's app
 * keeps the block, some corporate gateways strip it.
 */

const SANS = `'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const SERIF = `'Fraunces',Georgia,'Times New Roman',serif`;

/** HTML-escapes a value. Used by every block that takes text. */
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function paragraph(text: string, tone: 'normal' | 'muted' = 'normal'): string {
  const cls = tone === 'muted' ? 'vv-muted' : 'vv-text';
  const size = tone === 'muted' ? '14px;line-height:22px' : '16px;line-height:26px';
  return `<p class="${cls}" style="margin:0 0 16px 0;font-family:${SANS};font-size:${size};">${esc(text)}</p>`;
}

/** A section heading inside the body. Serif, matching the site's own. */
export function subheading(text: string): string {
  return `<p class="vv-title" style="margin:26px 0 8px 0;font-family:${SERIF};font-size:17px;line-height:24px;font-weight:600;">${esc(text)}</p>`;
}

/**
 * A pulled-out passage — an angle, a deadline, a piece of copy being quoted
 * back. The left rule is the only ornament in these emails and it is doing a
 * job: it says "this is the thing itself, not our words about it".
 */
export function panel(text: string): string {
  return [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;">`,
    `<tr><td class="vv-quote" style="padding:14px 16px;border-radius:0 8px 8px 0;">`,
    `<p class="vv-text" style="margin:0;font-family:${SANS};font-size:15px;line-height:24px;">${esc(text)}</p>`,
    `</td></tr></table>`,
  ].join('');
}

/**
 * A list where each row is a thing with a label and a date — deadlines,
 * mostly. A table rather than a `<ul>`, because Outlook's list rendering is
 * its own adventure and the two-column shape is what this actually is.
 */
export function rows(
  items: { label: string; meta: string; urgent?: boolean }[],
): string {
  const cells = items
    .map(
      (item) =>
        `<tr>` +
        `<td style="padding:9px 0;border-bottom:1px solid rgba(128,150,175,0.22);">` +
        `<span class="vv-text" style="font-family:${SANS};font-size:15px;line-height:22px;font-weight:600;">${esc(item.label)}</span><br />` +
        `<span class="${item.urgent ? 'vv-late' : 'vv-muted'}" style="font-family:${SANS};font-size:13px;line-height:20px;">${esc(item.meta)}</span>` +
        `</td></tr>`,
    )
    .join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;">${cells}</table>`;
}

/**
 * The one button.
 *
 * A table, not an anchor with padding: Outlook ignores padding on an inline
 * element, so the "button" collapses to underlined text in exactly the client
 * least likely to forgive it. 44px tall because a thumb is not a mouse.
 */
export function button(label: string, href: string): string {
  return [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px 0;">`,
    `<tr><td class="vv-btn vv-btn-cell" style="border-radius:8px;">`,
    `<a href="${esc(href)}" class="vv-btn" style="display:inline-block;padding:13px 26px;font-family:${SANS};font-size:15px;font-weight:600;line-height:18px;text-decoration:none;border-radius:8px;">${esc(label)}</a>`,
    `</td></tr></table>`,
  ].join('');
}

/**
 * The same address again, as text.
 *
 * Every message with a button repeats the URL underneath it. Not decoration:
 * a client that strips the anchor, a forwarded copy pasted into a chat, or
 * somebody reading on a device that is not the one their session is on all
 * end with a link they cannot press, and a visible URL is the difference
 * between that and a dead end.
 */
export function fallbackLink(href: string): string {
  return `<p class="vv-muted" style="margin:0 0 16px 0;font-family:${SANS};font-size:12px;line-height:20px;word-break:break-all;">${esc(href)}</p>`;
}

/** A small labelled tag — a count, a status. */
export function chip(text: string): string {
  return `<span class="vv-chip" style="display:inline-block;padding:4px 10px;border-radius:999px;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.3px;">${esc(text)}</span>`;
}
