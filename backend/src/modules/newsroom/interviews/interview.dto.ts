import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Visibility } from '@prisma/client';
import { VersionedUpdateDto } from '../../../common/dto/versioned-update.dto';

/**
 * An interview record is the meeting, not the words — the words are `Quote`
 * rows that point back at it. Only `interviewee` is required, because an
 * interview is very often booked before anyone knows what it will be about.
 *
 * `keyQuoteIds` is not accepted here. Which quotes an interview counts as key
 * is stored on the quote itself (`Quote.keyQuote`), and letting this DTO set it
 * too would create two writable spellings of one fact that can disagree. The
 * service reads it, and the quotes API writes it.
 */
export class CreateInterviewDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  interviewee!: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  purpose?: string;

  @IsISO8601()
  @IsOptional()
  conductedAt?: string;

  /** Free notes. Transcripts, if a recording is ever made, live here too. */
  @IsString()
  @IsOptional()
  notes?: string;

  /** Ordered list of open questions still to put to this interviewee. */
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(200)
  @IsOptional()
  followUps?: string[];

  /**
   * Defaults to CONFIDENTIAL, matching the schema and matching sources. An
   * interview record names who agreed to talk, which is the fact most worth
   * protecting even when nothing they said is sensitive.
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

export class UpdateInterviewDto extends VersionedUpdateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @IsOptional()
  interviewee?: string;

  @IsString()
  @IsOptional()
  role?: string | null;

  @IsString()
  @IsOptional()
  purpose?: string;

  @IsISO8601()
  @IsOptional()
  conductedAt?: string | null;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(200)
  @IsOptional()
  followUps?: string[];

  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  storyIds?: string[];
}
