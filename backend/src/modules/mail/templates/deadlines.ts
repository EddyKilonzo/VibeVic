import type { Message } from '../mail.service';
import { button, chip, paragraph, renderEmail, rows } from '../render';

export interface DueItem {
  label: string;
  /** Already formatted for a person, with the zone stated where it matters. */
  when: string;
  /** The piece it belongs to, if it belongs to one. */
  story?: string;
  overdue: boolean;
}

/**
 * "Here is what is due."
 *
 * ── Why this email exists at all ─────────────────────────────────────────
 * A deadline set inside a tool is only ever read by somebody who has opened
 * that tool, which is a reminder that reminds nobody — the failure mode of a
 * deadline is precisely that you were not thinking about it. The dashboard
 * strip answers "what is due" for a writer who is already at work; this
 * answers it for one who is not.
 *
 * ── Sent only when there is something to say ─────────────────────────────
 * The reminder service does not send an empty one. A daily "nothing is due"
 * is a message that trains its reader to stop opening the sender, and by the
 * time something *is* due they have a filter for it.
 *
 * ── No count of how late, and no scolding ────────────────────────────────
 * Overdue is marked because it is a fact about the clock. There is no "you
 * have missed 3 deadlines", no streak of misses, and no tone. The rest of
 * this newsroom refuses to score a journalist's judgement; scoring their
 * punctuality by email would be the same claim in a worse place.
 */
export function deadlinesEmail(options: {
  to: string;
  name: string;
  items: DueItem[];
  /** Where the deadlines actually live. */
  newsroomUrl: string;
}): Message {
  const { to, name, items, newsroomUrl } = options;

  const late = items.filter((item) => item.overdue).length;
  const soon = items.length - late;

  const text = [
    `Hello ${name},`,
    '',
    late > 0 && soon > 0
      ? `${late} past its date, ${soon} coming up.`
      : late > 0
        ? `${late} past ${late === 1 ? 'its' : 'their'} date.`
        : `${soon} coming up.`,
    '',
    ...items.map((item) =>
      [
        `  ${item.label}`,
        `    ${item.when}${item.overdue ? ' — overdue' : ''}${item.story ? ` · ${item.story}` : ''}`,
      ].join('\n'),
    ),
    '',
    'They are set and ticked off in the newsroom:',
    newsroomUrl,
    '',
    '— The VibeVic newsroom',
  ].join('\n');

  const html = renderEmail({
    subject: subjectFor(late, soon),
    // The first item, because on a phone that line is often the entire
    // message a person needs — and if it is enough, they should not have to
    // open anything.
    preheader: items[0] ? `${items[0].label} — ${items[0].when}` : 'What is due.',
    heading: 'What is due',
    body: [
      paragraph(`Hello ${name},`),
      late > 0 ? chip(`${late} overdue`) : '',
      rows(
        items.map((item) => ({
          label: item.label,
          meta: [item.when + (item.overdue ? ' — overdue' : ''), item.story]
            .filter(Boolean)
            .join(' · '),
          urgent: item.overdue,
        })),
      ),
      button('Open the newsroom', newsroomUrl),
    ].join(''),
    footnote:
      'You are reading this because you set these dates yourself. They are ticked off on the ' +
      'dashboard, and this stops arriving when nothing is outstanding.',
  });

  return { to, subject: subjectFor(late, soon), text, html };
}

/**
 * The subject carries the number, because that is the decision the reader is
 * making in the inbox: is this worth opening now. "Newsroom reminder" makes
 * them open it to find out, which is the same as making them open all of them.
 */
function subjectFor(late: number, soon: number): string {
  if (late > 0 && soon > 0) return `${late} overdue, ${soon} coming up`;
  if (late > 0) return `${late} deadline${late === 1 ? '' : 's'} overdue`;
  return `${soon} deadline${soon === 1 ? '' : 's'} coming up`;
}
