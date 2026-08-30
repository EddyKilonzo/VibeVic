import type { Message } from '../mail.service';

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

  const safeName = escapeHtml(name);
  const safeAt = escapeHtml(at);
  const safeUrl = escapeHtml(resetUrl);

  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '<body style="margin:0;background:#f6f6f4;padding:32px 16px;font:15px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1c1a">',
    '<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e0;border-radius:10px">',
    '<tr><td style="padding:32px">',
    `<p style="margin:0 0 20px">Hello ${safeName},</p>`,
    `<p style="margin:0 0 20px">The password on your VibeVic newsroom account was changed on <strong>${safeAt}</strong>.</p>`,
    '<p style="margin:0 0 20px">Every session that was signed in before that has been ended, on every device, so you will be asked to sign in again.</p>',
    '<p style="margin:0 0 20px">If that was you, there is nothing to do.</p>',
    `<p style="margin:0 0 24px">If it was not, somebody else has reached this mailbox and used it to take the account. <a href="${safeUrl}" style="color:#1c1c1a">Ask for a new password link</a> straight away — that cancels whatever they have and ends their session too.</p>`,
    `<p style="margin:0;padding-top:20px;border-top:1px solid #e4e4e0;color:#6b6b64;font-size:13px;word-break:break-all">${safeUrl}</p>`,
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('\n');

  return {
    to,
    // Stated as a fact that has already happened, because it has. "Did you
    // change your password?" invites the reader to decide it is spam.
    subject: 'Your newsroom password was changed',
    text,
    html,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
