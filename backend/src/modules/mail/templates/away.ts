import type { Message } from '../mail.service';
import { button, panel, paragraph, renderEmail } from '../render';

/**
 * "It has been a while."
 *
 * ── The hardest email in the product to get right ────────────────────────
 * Everything else here is a fact somebody asked for: a link they requested, a
 * pitch they sent, a date they set. This one arrives unasked, about not
 * working, addressed to somebody whose job is creative and whose reasons for
 * being away are their own. Almost every product that sends this sends
 * something insulting.
 *
 * So the rules it is written under:
 *
 *   * It never says the streak was lost, broken, or failed. A run that has
 *     ended is not a punishment and the longest one still stands — which is
 *     why the record is what gets mentioned, not the gap.
 *   * It does not ask why, and it does not assume. Illness, a holiday, a
 *     story being reported entirely in a notebook — all of those look
 *     identical from here, and only one of them is "not writing".
 *   * It offers the one thing that is actually useful: the piece that was
 *     open, by name. What gets somebody back to a draft is remembering what
 *     the draft was, and a generic "come back and write!" supplies nothing.
 *   * It is sent once, not daily. `User.awayNoticeAt` exists so this cannot
 *     become a drip.
 *
 * ── Why it mentions the record and not the current streak ────────────────
 * The current streak is zero by definition when this sends. Printing a zero
 * would be the scolding the whole message is written to avoid; printing the
 * longest run is a true thing about the reader that is worth reading.
 */
export function awayEmail(options: {
  to: string;
  name: string;
  /** Whole days since the newsroom was last opened. */
  days: number;
  /** The longest run of consecutive days, ever. Omitted when it is trivial. */
  longestStreak: number;
  /** The piece that was open, if there was one. */
  openDraft?: string;
  newsroomUrl: string;
}): Message {
  const { to, name, days, longestStreak, openDraft, newsroomUrl } = options;

  const record =
    longestStreak >= 3
      ? `Your longest run in the newsroom is ${longestStreak} days, and that stands whatever happens next.`
      : '';

  const text = [
    `Hello ${name},`,
    '',
    `The newsroom has not been opened in ${days} days. That is all this is — a note,`,
    'not a nudge, and there are plenty of good reasons for it.',
    '',
    ...(openDraft ? [`In case it helps: "${openDraft}" is still open where you left it.`, ''] : []),
    ...(record ? [record, ''] : []),
    'When you want it:',
    newsroomUrl,
    '',
    '— The VibeVic newsroom',
  ].join('\n');

  const html = renderEmail({
    subject: 'Your newsroom is where you left it',
    preheader: openDraft
      ? `"${openDraft}" is still open.`
      : `${days} days since it was last opened.`,
    heading: 'Where you left it',
    body: [
      paragraph(`Hello ${name},`),
      paragraph(
        `The newsroom has not been opened in ${days} days. That is all this is — a note, not ` +
          'a nudge, and there are plenty of good reasons for it.',
      ),
      ...(openDraft
        ? [paragraph('In case it helps, this is still open where you left it:'), panel(openDraft)]
        : []),
      ...(record ? [paragraph(record, 'muted')] : []),
      button('Open the newsroom', newsroomUrl),
    ].join(''),
    footnote:
      'Sent once, not daily. Nothing has expired, nothing has been lost, and no draft has ' +
      'been touched.',
  });

  return { to, subject: 'Your newsroom is where you left it', text, html };
}
