import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * Shape only. Nothing consumes this yet — `AuthService.issueToken` throws — and
 * the DTO exists so the contract is reviewable before the implementation makes
 * it dangerous to get wrong.
 */
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12)
  password!: string;
}
