import type { Message } from '../mail.service';

/**
 * A pitch, as an editor receives it.
 *
 * ── Why this is a plain letter and not a document ────────────────────────
 * The pitch desk produces the shape of the reporting — the angle, who would
 * have to be called, the questions the piece would answer — and then it sat
 * there. `Pitch.targetPublication` has been a column since the newsroom was
 * written and nothing could act on it, so the last step of a pitch was
 * retyping it into a mail client.
 *
 * What arrives is what an editor actually reads: a subject with the angle in
 * it, the case in a paragraph, and then what is known and what is not. No
 * attachment, no branded header, no tracking pixel. Commissioning editors
 * read pitches on phones between other things, and the ones that get answered
 * are the ones that can be read without opening anything.
 *
 * ── Why the sections are omitted when empty rather than left blank ───────
 * A heading with nothing under it reads as an answer — "what is unknown:" and
 * silence says the reporter has not thought about it. An absent heading says
 * only that this pitch did not use that section.
 *
 * ── What is never in here ────────────────────────────────────────────────
 * Sources. `PitchSource` is a reference and the schema is explicit about why:
 * "a pitch that inlined contact details would become a second place
 * responsible for protecting them." An email is a worse second place than
 * most — it is copied, forwarded and retained by a server nobody here
 * controls. The count travels, so an editor knows the reporting has people
 * behind it; the people do not.
 */
export function pitchEmail(options: {
  to: string;
  /** The journalist's own covering line, if they wrote one. */
  note?: string;
  title: string;
  angle: string;
  whyItMatters?: string;
  whatIsKnown?: string;
  whatIsUnknown?: string;
  /** Already formatted for a person, with its zone stated. */
  deadline?: string;
  /** How many sources are attached. Never who they are. */
  sourceCount: number;
  /** How to reply. The writer's own address, not the relay's. */
  fromName: string;
}): Message {
  const {
    to,
    note,
    title,
    angle,
    whyItMatters,
    whatIsKnown,
    whatIsUnknown,
    deadline,
    sourceCount,
    fromName,
  } = options;

  const section = (heading: string, body?: string): string[] =>
    body?.trim() ? ['', heading, body.trim()] : [];

  const text = [
    ...(note?.trim() ? [note.trim(), ''] : []),
    title,
    '',
    angle,
    ...section('Why it matters', whyItMatters),
    ...section('What is known', whatIsKnown),
    ...section('What is still open', whatIsUnknown),
    ...(deadline ? ['', `Filing by ${deadline}.`] : []),
    ...(sourceCount > 0
      ? [
          '',
          `${sourceCount} source${sourceCount === 1 ? '' : 's'} lined up. Happy to talk about who,`,
          'but not in an email.',
        ]
      : []),
    '',
    '—',
    fromName,
  ].join('\n');

  return {
    to,
    // The angle in the subject, not the word "pitch". An editor scanning a
    // full inbox is deciding on this line alone, and "Pitch: …" spends the
    // most valuable part of it saying something they can already see.
    subject: title,
    text,
  };
}
