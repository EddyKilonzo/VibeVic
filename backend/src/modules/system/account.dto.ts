import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Creating an account.
 *
 * There is no password field, and there is no way to add one that would be an
 * improvement — see the note at the top of `accounts.service.ts`. The role is
 * a real enum rather than a string, so an unknown value is a 400 from the
 * validation pipe and never a row with a role nothing understands.
 */
export class CreateAccountDto {
  @IsEmail({}, { message: 'That is not an email address.' })
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(1, { message: 'An account needs a name.' })
  @MaxLength(120)
  name!: string;

  @IsEnum(Role, { message: 'Role must be WRITER or DEV.' })
  role!: Role;
}
