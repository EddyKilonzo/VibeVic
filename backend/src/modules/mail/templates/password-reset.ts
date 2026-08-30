import type { Message } from '../mail.service';

/**
 * The one email this server sends, written out in full.
 *
 * ── Why the copy is here and not in a template engine ────────────────────
 * There is one message. A templating layer would be four files and a build
 * step to produce what a function already produces, and the words in a
 * security email deserve to be read in review rather than assembled at
 * runtime out of fragments.
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

  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(url);

  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '<body style="margin:0;background:#f6f6f4;padding:32px 16px;font:15px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1c1a">',
    '<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e0;border-radius:10px">',
    '<tr><td style="padding:32px">',
    `<p style="margin:0 0 20px">Hello ${safeName},</p>`,
    '<p style="margin:0 0 20px">Someone asked for a way back into the VibeVic newsroom with this address.</p>',
    `<p style="margin:0 0 24px"><a href="${safeUrl}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:600">Choose a new password</a></p>`,
    `<p style="margin:0 0 20px;color:#6b6b64;font-size:13px">The link works once and expires in ${minutes} minutes. If the button does not work, copy this address:<br><span style="word-break:break-all;color:#1c1c1a">${safeUrl}</span></p>`,
    '<p style="margin:0;padding-top:20px;border-top:1px solid #e4e4e0;color:#6b6b64;font-size:13px">If this was not you, nothing has happened yet — no password has changed and you do not need to do anything. It is worth knowing that somebody tried, though.</p>',
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('\n');

  return {
    to,
    // Deliberately not "Reset your password", which reads as though it already
    // happened. This says what the email is: a request, waiting on the reader.
    subject: 'A way back into the VibeVic newsroom',
    text,
    html,
  };
}

/**
 * The name comes from the database and the URL is built from configuration, so
 * neither is attacker-controlled today. Escaped anyway: the day someone lets a
 * person edit their own display name, this file should already be right rather
 * than be the thing that was forgotten.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
