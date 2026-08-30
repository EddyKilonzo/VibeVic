import { IsEmail, MaxLength } from 'class-validator';

/**
 * One field, on purpose.
 *
 * Anything else a form might send — a "reason", a redirect, a role — would be
 * attacker-controlled input on an unauthenticated route that sends mail. The
 * link is built entirely from server-side configuration.
 */
export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
