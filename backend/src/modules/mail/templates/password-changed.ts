import type { Message } from '../mail.service';
import { button, fallbackLink, paragraph, renderEmail } from '../render';

/**
 * "Your password was changed."
 *
 * ── Why this is sent at all ──────────────────────────────────────────────
 * It is the only message in the flow that reaches someone who did not ask for
 * anything. Everything else — the link, the form, the sign-in page — is read
 * by a person who is already holding the thread. This one is for the case
 * where they are not: somebody else has been through their mailbox, spent a
 * reset link, and now holds the account. Without this the first sign is that
 * the old password stopped working, which reads as a bug rather than as a
 * theft, and the hours in between are the hours that matter.
 *
 * ── Why it does not offer an undo ────────────────────────────────────────
 * A "this wasn't me" link would be a second credential in a second email, in
 * the mailbox that has just been shown to be reachable by somebody else. The
 * useful instruction is the one that does not depend on the mailbox: ask for
 * a reset yourself, which cancels every outstanding link and moves the
 * revocation clock again.
 *
 * ── What it does not contain ─────────────────────────────────────────────
 * No token, no link that does anything, and nothing about the password
 * itself. A message that says only "this happened, at this time" is safe to
 * sit in a mailbox for years.
 */
export function passwordChangedEmail(options: {
  to: string;
  name: string;
  /** When it happened, already formatted for a human in a stated zone. */
  at: string;
  /** Where to go and ask for a new link, if this was not them. */
  resetUrl: string;
}): Message {
  const { to, name, at, resetUrl } = options;

  const text = [
    `Hello ${name},`,
    '',
    `The password on your VibeVic newsroom account was changed on ${at}.`,
    '',
    'Every session that was signed in before that has been ended, on every',
    'device, so you will be asked to sign in again.',
    '',
    'If that was you, there is nothing to do.',
    '',
    'If it was not, somebody else has reached this mailbox and used it to take',
    'the account. Ask for a new password link straight away — that cancels',
    'whatever they have and ends their session too:',
    '',
    resetUrl,
    '',
    '— The VibeVic newsroom',
  ].join('\n');

  const html = renderEmail({
    subject: 'Your newsroom password was changed',
    preheader: `Changed on ${at}. Every signed-in session has been ended.`,
    heading: 'Your password was changed',
    body: [
      paragraph(`Hello ${name},`),
      paragraph(`The password on your VibeVic newsroom account was changed on ${at}.`),
      paragraph(
        'Every session that was signed in before that has been ended, on every device, so you ' +
          'will be asked to sign in again.',
      ),
      paragraph('If that was you, there is nothing to do.'),
      paragraph(
        'If it was not, somebody else has reached this mailbox and used it to take the ' +
          'account. Ask for a new password link straight away — that cancels whatever they ' +
          'have and ends their session too.',
      ),
      button('Ask for a new link', resetUrl),
      fallbackLink(resetUrl),
    ].join(''),
    footnote:
      'This message contains no link that changes anything on its own, and no token. It is ' +
      'safe to keep.',
  });

  return {
    to,
    // Stated as a fact that has already happened, because it has. "Did you
    // change your password?" invites the reader to decide it is spam.
    subject: 'Your newsroom password was changed',
    text,
    html,
  };
}
