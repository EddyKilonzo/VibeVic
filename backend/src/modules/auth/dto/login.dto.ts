import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * What `POST /auth/token` accepts, and what `AuthService.issueToken` reads.
 *
 * This said "shape only, nothing consumes this yet" for as long as
 * `issueToken` was a stub. It is not one: it normalises the address, verifies
 * an argon2id digest, burns the same time when there is no account to check
 * against, and counts failures against a throttle. The only throw left in it
 * is the refusal to issue a token no route would accept when `AUTH_MODE` is
 * not `jwt`, which is a configuration answer rather than a missing feature.
 */
export class LoginDto {
  @IsEmail()
  // RFC 5321's limit. An address longer than this is not one, and the check
  // costs nothing compared to letting it reach a query.
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(12)
  // A ceiling, because everything below this line is about to be hashed with
  // a deliberately expensive function. The body parser caps a request at
  // 100kb, so this is a second fence rather than the only one — but the first
  // fence is a default in someone else's package, and argon2 is the one place
  // in this API where the cost of a request is chosen by its caller.
  @MaxLength(200)
  password!: string;
}
