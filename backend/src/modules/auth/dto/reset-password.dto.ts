import { IsString, Length, MaxLength, MinLength } from 'class-validator';

/**
 * The token comes back in the body rather than staying in the query string it
 * arrived on. A URL is written to browser history, to the Referer header of
 * anything the page loads, and to any proxy log in between; a POST body is
 * not. The reset page reads it from the address and posts it here.
 */
export class ResetPasswordDto {
  /** 64 hex characters — 32 bytes of `randomBytes`. Length checked here so a
   *  wrong-shaped value is refused before it costs a database round trip. */
  @IsString()
  @Length(64, 64)
  token!: string;

  /**
   * Twelve, matching LoginDto.
   *
   * A length floor and nothing else: no character-class rule, because those
   * push people towards `Passw0rd!` and away from the long ordinary phrase
   * that is actually harder to guess.
   */
  @IsString()
  @MinLength(12)
  // The same ceiling as LoginDto, for the same reason: argon2 is about to run
  // on this.
  @MaxLength(200)
  password!: string;
}
