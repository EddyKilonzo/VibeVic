import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../../config/env';

export interface Message {
  to: string;
  subject: string;
  /** Always required. HTML is the enhancement, never the only copy. */
  text: string;
  html?: string;
}

/**
 * Sending mail.
 *
 * ── One transport, behind one method ─────────────────────────────────────
 * Every message this server sends goes through `send`, so the questions that
 * have to be asked once — is a mailer configured, what address does it come
 * from, what happens when the relay is down — are asked in one place.
 *
 * ── SMTP rather than a provider SDK ──────────────────────────────────────
 * This was Resend's HTTP API. It is Brevo's relay now, and what changed is
 * four environment variables and the two lines that build a transport — which
 * is the whole argument. A provider package puts a vendor's name in the
 * imports of a service whose job is "send this text to that address", and
 * every one of them models the same RFC differently, so moving is a rewrite.
 * Brevo, Postmark, SES, Resend's own relay and a Postfix box all speak SMTP.
 *
 * The cost is honest: SMTP is a connection rather than a request, so a send
 * is slower than an HTTPS POST and the failure modes are a socket's rather
 * than a status code's. For one email on a password reset, that is nothing.
 *
 * ── Not configured is a refusal, not a silence ───────────────────────────
 * With no host, `send` throws. It would be easy to log a warning and return —
 * and that is exactly the failure that hurts: a password reset that reports
 * success, sends nothing, and leaves someone waiting on an email that was
 * never going to arrive. The caller turns this into a 503 that says the
 * newsroom cannot send mail yet, which is at least true.
 *
 * ── What is never in a log line ──────────────────────────────────────────
 * Bodies. A reset email contains a working credential for somebody's account,
 * and a log is where secrets go to be retained. The log records that a message
 * of a given kind went to a given address and whether the relay accepted it;
 * the contents stay in the message.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    const host = this.config.get('SMTP_HOST', { infer: true });
    const user = this.config.get('SMTP_USER', { infer: true });
    const pass = this.config.get('SMTP_PASS', { infer: true });
    this.from = this.config.get('SMTP_FROM', { infer: true }) ?? '';

    if (!host || !user || !pass || !this.from) {
      this.transport = null;
      this.logger.warn(
        'SMTP is not configured — nothing can send mail. Password reset answers 503.',
      );
      return;
    }

    const port = this.config.get('SMTP_PORT', { infer: true });

    this.transport = createTransport({
      host,
      port,
      /*
       * 465 is implicit TLS: the socket is encrypted before a byte of SMTP is
       * spoken. 587 and 2525 are explicit — the session opens in the clear and
       * is upgraded by STARTTLS, which `requireTLS` makes non-negotiable
       * rather than an optimistic attempt. Without it a relay that fails to
       * offer STARTTLS is silently talked to in plaintext, and the credential
       * below goes with it.
       */
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user, pass },
      /*
       * A password reset is on a person's critical path and the request is
       * holding a connection open while this runs. A relay that has stopped
       * answering should become a 503 in seconds rather than whenever the
       * kernel gives up on the socket.
       */
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  /** Whether a caller should offer a feature that depends on email at all. */
  get configured(): boolean {
    return this.transport !== null;
  }

  async send(message: Message): Promise<void> {
    if (!this.transport) {
      throw new ServiceUnavailableException(
        'This server cannot send email. Set SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM.',
      );
    }

    const replyTo = this.config.get('MAIL_REPLY_TO', { infer: true });
    /*
     * The envelope sender, when it differs from the `From` header.
     *
     * Brevo verifies a sender address and will reject a message whose envelope
     * comes from somewhere else, even though the header may render a display
     * name. Setting it explicitly is also what keeps a bounce going somewhere
     * a person reads rather than to whatever the relay guesses.
     */
    const sender = this.config.get('SENDER_EMAIL', { infer: true });

    try {
      const receipt = await this.transport.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
        ...(replyTo ? { replyTo } : {}),
        ...(sender ? { envelope: { from: sender, to: message.to } } : {}),
      });

      /*
       * Accepted is not delivered, and the log should not claim otherwise.
       * The relay has taken the message; what happens between it and the
       * recipient's mail server is not visible from here.
       */
      this.logger.log(`Relay accepted a message for ${message.to} (${receipt.messageId}).`);
    } catch (cause) {
      // The relay's own message names the account and the host, which is what
      // whoever configured this needs. It goes to the log; the caller gets a
      // sentence that does not describe somebody else's infrastructure.
      this.logger.error(`SMTP send to ${message.to} failed.`, cause);
      throw new ServiceUnavailableException(
        'The newsroom could not send that email. The mail relay refused it.',
      );
    }
  }

  /**
   * Ask the relay whether it would take a message, without sending one.
   *
   * Not called on the request path — it opens a connection, and doing that
   * per password reset would double the latency of the one flow that has a
   * person waiting on it. It is here for a startup check or a health route to
   * use, so "is the mailer actually working" has an answer that does not
   * require somebody to lose their password first.
   */
  async verify(): Promise<boolean> {
    if (!this.transport) return false;
    try {
      await this.transport.verify();
      return true;
    } catch (cause) {
      this.logger.error('SMTP relay refused the connection check.', cause);
      return false;
    }
  }
}
