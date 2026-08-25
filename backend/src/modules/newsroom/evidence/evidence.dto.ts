import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Visibility } from '@prisma/client';
import { VersionedUpdateDto } from '../../../common/dto/versioned-update.dto';

/**
 * A piece of evidence, and the claim it stands up.
 *
 * `supports` is the field that makes this table worth having. A folder of
 * documents nobody has written a sentence about is a folder, not evidence; the
 * record is useful precisely because it says what the document is supposed to
 * prove, so that a fact-check can disagree with it.
 *
 * `reference` is free text — a link, a filename, a shelf. There is no upload
 * pipeline behind it and this DTO does not pretend otherwise: a typed
 * attachment field would imply the bytes are held here, and they are not.
 */
export class CreateEvidenceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @IsString()
  @IsOptional()
  supports?: string;

  @IsString()
  @IsOptional()
  sourceId?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  entityIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  storyIds?: string[];

  /** Defaults to PRIVATE in the service, matching the schema. */
  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;
}

export class UpdateEvidenceDto extends VersionedUpdateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  supports?: string;

  @IsString()
  @IsOptional()
  sourceId?: string | null;

  @IsString()
  @IsOptional()
  reference?: string | null;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  entityIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  storyIds?: string[];

  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;
}
