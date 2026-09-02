import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SourceStatus, Visibility } from '@prisma/client';
import { VersionedUpdateDto } from '../../../common/dto/versioned-update.dto';

export class CreateSourceDto {
  /** May be a pseudonym. The API does not require the real name. */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  organisation?: string;

  @IsUrl()
  @IsOptional()
  url?: string;

  /** The date the URL was actually opened. Never defaulted to "now". */
  @IsISO8601()
  @IsOptional()
  accessedAt?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsEnum(SourceStatus)
  @IsOptional()
  status?: SourceStatus;

  /**
   * Defaults to CONFIDENTIAL in the service when omitted. A source whose
   * visibility was forgotten is a source that has not been cleared for
   * publication, and the schema default agrees.
   */
  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;

  /**
   * The identity behind a pseudonym. Accepted only from a principal holding
   * newsroom:confidential, and never returned by a list or read — see
   * SourcesService.revealProtectedIdentity.
   */
  @IsString()
  @IsOptional()
  protectedIdentity?: string;

  /**
   * The stories this source is behind.
   *
   * `StorySource` has existed since the schema was written and the client type
   * has declared `storyIds` for just as long — but no DTO accepted the field
   * and no query returned it, so the link could only ever be made by hand in
   * the database. Sources were the one story-linkable collection missing this;
   * quotes, interviews, evidence and timeline events have all carried it from
   * the start.
   *
   * The consequence was not only a missing feature. `Source.storyIds` was
   * typed as `string[]` on the client and arrived `undefined`, so the first
   * screen to read it would have thrown rather than shown an empty list.
   */
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  storyIds?: string[];
}

export class UpdateSourceDto extends VersionedUpdateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  organisation?: string;

  @IsUrl()
  @IsOptional()
  url?: string;

  @IsISO8601()
  @IsOptional()
  accessedAt?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsEnum(SourceStatus)
  @IsOptional()
  status?: SourceStatus;

  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;

  @IsString()
  @IsOptional()
  protectedIdentity?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  storyIds?: string[];
}
