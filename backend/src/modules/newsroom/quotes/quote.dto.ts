import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { SourceStatus, Visibility } from '@prisma/client';
import { VersionedUpdateDto } from '../../../common/dto/versioned-update.dto';

/**
 * A quote is words someone actually said, so `text` and `speaker` are the two
 * required fields and neither has a sensible default. An attributed quote with
 * no speaker is a paraphrase, and the difference is the reason the record
 * exists.
 *
 * There is no length cap on `text`. A cap would be an arbitrary limit on how
 * much of an answer a journalist may keep verbatim, and the failure it invites
 * — silently truncating testimony — is far worse than a long row.
 */
export class CreateQuoteDto {
  @IsString()
  @MinLength(1)
  text!: string;

  @IsString()
  @MinLength(1)
  speaker!: string;

  @IsString()
  @IsOptional()
  speakerRole?: string;

  /** When it was said, which is not when it was written down. */
  @IsISO8601()
  @IsOptional()
  saidAt?: string;

  @IsString()
  @IsOptional()
  sourceId?: string;

  @IsString()
  @IsOptional()
  interviewId?: string;

  /** Whether the interview counts this among its key quotes. */
  @IsBoolean()
  @IsOptional()
  keyQuote?: boolean;

  @IsEnum(SourceStatus)
  @IsOptional()
  status?: SourceStatus;

  /**
   * Defaults to PRIVATE in the service, matching the schema. A quote is not
   * confidential by default the way a source is — the words can usually be
   * repeated even when the person cannot be named — but it is never
   * publishable until somebody says so.
   */
  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  storyIds?: string[];
}

export class UpdateQuoteDto extends VersionedUpdateDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  text?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  speaker?: string;

  @IsString()
  @IsOptional()
  speakerRole?: string | null;

  @IsISO8601()
  @IsOptional()
  saidAt?: string | null;

  @IsString()
  @IsOptional()
  sourceId?: string | null;

  @IsString()
  @IsOptional()
  interviewId?: string | null;

  @IsBoolean()
  @IsOptional()
  keyQuote?: boolean;

  @IsEnum(SourceStatus)
  @IsOptional()
  status?: SourceStatus;

  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  storyIds?: string[];
}
