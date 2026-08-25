import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { VersionedUpdateDto } from '../../../common/dto/versioned-update.dto';

/**
 * A pitch is an idea worked up far enough to put to an editor.
 *
 * `angle` is required alongside `title` because the difference between the two
 * is the whole point of the record: the title is the subject, the angle is the
 * specific claim being made about it, and a pitch without one is a subject area
 * rather than a pitch.
 *
 * `sourceIds` are references and never inlined contact details. A pitch that
 * copied a source's name and number would become a second place responsible
 * for protecting them, and the one that gets forgotten in an export.
 */
export class CreatePitchDto {
  @IsString()
  @IsOptional()
  ideaId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  angle!: string;

  @IsString()
  @IsOptional()
  whyItMatters?: string;

  @IsString()
  @IsOptional()
  whatIsKnown?: string;

  /** What is still unknown. An empty answer here is a pitch that is not ready. */
  @IsString()
  @IsOptional()
  whatIsUnknown?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  sourceIds?: string[];

  @IsString()
  @IsOptional()
  targetPublication?: string;

  @IsISO8601()
  @IsOptional()
  deadline?: string;

  @IsString()
  @IsOptional()
  storyId?: string;
}

export class UpdatePitchDto extends VersionedUpdateDto {
  @IsString()
  @IsOptional()
  ideaId?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @IsOptional()
  title?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @IsOptional()
  angle?: string;

  @IsString()
  @IsOptional()
  whyItMatters?: string;

  @IsString()
  @IsOptional()
  whatIsKnown?: string;

  @IsString()
  @IsOptional()
  whatIsUnknown?: string;

  /**
   * Absent leaves the linked sources alone; a list replaces them. There is no
   * way to spell "remove every source" other than sending `[]`, which is
   * deliberate — an empty array is a decision and an omitted key is not.
   */
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  sourceIds?: string[];

  @IsString()
  @IsOptional()
  targetPublication?: string | null;

  @IsISO8601()
  @IsOptional()
  deadline?: string | null;

  @IsString()
  @IsOptional()
  storyId?: string | null;
}
