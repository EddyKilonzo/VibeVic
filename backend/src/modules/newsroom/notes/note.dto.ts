import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Visibility } from '@prisma/client';
import { VersionedUpdateDto } from '../../../common/dto/versioned-update.dto';

/**
 * A working note. The journalist thinking out loud, attached to a story or
 * standing on its own.
 *
 * PRIVATE by default rather than CONFIDENTIAL, and the difference is who the
 * record is about. A source record protects somebody else, so it starts at the
 * strictest tier; a note is the writer's own reasoning, and locking their own
 * thinking away from themselves by default would only teach them to reach for
 * the override every time.
 */
export class CreateNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsString()
  @IsOptional()
  storyId?: string;

  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;
}

export class UpdateNoteDto extends VersionedUpdateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsString()
  @IsOptional()
  storyId?: string | null;

  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;
}
