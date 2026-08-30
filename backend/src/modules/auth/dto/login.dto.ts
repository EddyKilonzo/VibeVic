import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Shape only. Nothing consumes this yet — `AuthService.issueToken` throws — and
 * the DTO exists so the contract is reviewable before the implementation makes
 * it dangerous to get wrong.
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
