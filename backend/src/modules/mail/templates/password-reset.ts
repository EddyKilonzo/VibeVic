import type { Message } from '../mail.service';
import { button, paragraph, renderEmail } from '../render';

/**
 * The one email this server sends, written out in full.
 *
 * ── The copy is here; the shell is not ───────────────────────────────────
 * This used to argue against a template engine on the grounds that there was
 * one message. There are four now, and the argument has aged the way that
 * kind of argument does: the layout was copied into each of them, and the two
 * copies had already drifted into slightly different greys.
 *
 * So the words stay here, in a function, where a security email's copy can be
 * read in review — and the shell they sit in comes from `views/layout.ejs`,
 * where the brand palette, the client's dark mode and the phone breakpoint
 * are decided once. What is templated is the frame, not the sentences.
 *
 * ── What the words are doing ─────────────────────────────────────────────
 * Two facts have to survive being skimmed: how long the link lasts, and what
 * to do if the reader did not ask for it. The second is the important one. An
 * unexpected reset email is the earliest signal a person gets that somebody is
 * trying their account, and it should not be buried under instructions — so it
 * is a paragraph in its own right, and it says plainly that nothing has
 * changed yet, because "reset your password" in a subject line reads to most
 * people as though it already has.
 *
 * No tracking pixel, no click wrapper, no remote image. A message about a
 * credential should not also be a request to a third party.
 *
 * ── The address is in the button, and only in the button ─────────────────
 * The HTML part shows a labelled button and no visible URL. A reset link is
 * 64 hex characters on the end of a path; printed in full it wraps across
 * three lines, and a wrapped credential is one somebody copies wrongly.
 *
 * The plain-text part still prints it, because there it is the only way to
 * follow the link at all — and that part is what a reader whose client cannot
 * render the button will be shown, which is the fallback the HTML no longer
 * needs to carry itself.
 */
export function passwordResetEmail(options: {
  to: string;
  name: string;
  url: string;
  minutes: number;
}): Message {
  const { to, name, url, minutes } = options;

  const text = [
    `Hello ${name},`,
    '',
    'Someone asked for a way back into the VibeVic newsroom with this address.',
    `Open this link within ${minutes} minutes to choose a new password:`,
    '',
    url,
    '',
    'The link works once. After that, or after it expires, ask for another.',
    '',
    'If this was not you, nothing has happened yet — no password has changed and',
    'you do not need to do anything. Ignoring this email leaves the account as it',
    'was. It is worth knowing that somebody tried, though.',
    '',
    '— The VibeVic newsroom',
  ].join('\n');

  const html = renderEmail({
    subject: 'A way back into the VibeVic newsroom',
    preheader: `The link works once and lasts ${minutes} minutes.`,
    heading: 'A way back in',
    body: [
      paragraph(`Hello ${name},`),
      paragraph('Someone asked for a way back into the VibeVic newsroom with this address.'),
      button('Choose a new password', url),
      paragraph(`The button works once and expires in ${minutes} minutes.`, 'muted'),
    ].join(''),
    footnote:
      'If this was not you, nothing has happened yet — no password has changed and you do not ' +
      'need to do anything. It is worth knowing that somebody tried, though.',
  });

  return {
    to,
    // Deliberately not "Reset your password", which reads as though it already
    // happened. This says what the email is: a request, waiting on the reader.
    subject: 'A way back into the VibeVic newsroom',
    text,
    html,
  };
}

/*
 * The escaping that used to live here now lives in `render.ts`, applied by
 * every block rather than by each template remembering to call it. The reason
 * it was here is unchanged and worth keeping: the name comes from the database
 * and the URL from configuration, so neither is attacker-controlled today —
 * and the day somebody lets a person edit their own display name, this should
 * already be right rather than be the thing that was forgotten.
 */
