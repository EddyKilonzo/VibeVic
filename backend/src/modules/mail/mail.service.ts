import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
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
 * ── One provider, behind one method ──────────────────────────────────────
 * Every message this server sends goes through `send`, so the questions that
 * have to be asked once — is a provider configured, what address does it come
 * from, what happens when the provider is down — are asked in one place. The
 * Resend client is the only thing in this file that knows which provider it
 * is; swapping it is this class and nothing else, the same shape the pitch
 * route settled on for its choice of model.
 *
 * ── Not configured is a refusal, not a silence ───────────────────────────
 * With no key, `send` throws. It would be easy to log a warning and return —
 * and that is exactly the failure that hurts: a password reset that reports
 * success, sends nothing, and leaves someone waiting on an email that was
 * never going to arrive. The caller turns this into a 503 that says the
 * newsroom cannot send mail yet, which is at least true.
 *
 * ── What is never in a log line ──────────────────────────────────────────
 * Bodies. A reset email contains a working credential for somebody's account,
 * and a log is where secrets go to be retained. The log records that a message
 * of a given kind went to a given address and whether the provider accepted
 * it; the contents stay in the message.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly client: Resend | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    const key = this.config.get('RESEND_API_KEY', { infer: true });
    this.client = key ? new Resend(key) : null;
    this.from = this.config.get('MAIL_FROM', { infer: true }) ?? '';

    if (!this.client) {
      this.logger.warn(
        'RESEND_API_KEY is not set — nothing can send mail. Password reset answers 503.',
      );
    }
  }

  /** Whether a caller should offer a feature that depends on email at all. */
  get configured(): boolean {
    return this.client !== null && this.from.length > 0;
  }

  async send(message: Message): Promise<void> {
    if (!this.client || !this.from) {
      throw new ServiceUnavailableException(
        'This server cannot send email. Set RESEND_API_KEY and MAIL_FROM.',
      );
    }

    const replyTo = this.config.get('MAIL_REPLY_TO', { infer: true });

    const { error } = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
      ...(replyTo ? { replyTo } : {}),
    });

    if (error) {
      // The provider's message names the account and the domain, which is
      // operator information rather than caller information. It goes here.
      this.logger.error(`Resend refused a message to ${message.to}: ${error.message}`);
      throw new ServiceUnavailableException(
        'The email could not be sent. Nothing was changed.',
      );
    }

    this.logger.log(`Sent "${message.subject}" to ${message.to}.`);
  }
}
