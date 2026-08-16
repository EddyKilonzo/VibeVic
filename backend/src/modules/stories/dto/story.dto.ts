import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { StoryStatus } from '@prisma/client';
import { VersionedUpdateDto } from '../../../common/dto/versioned-update.dto';

/**
 * Blocks are typed `unknown[]` here and parsed with zod in the service rather
 * than described twice in class-validator decorators. One schema for the block
 * union (common/content/story-block.ts) is the point — two would drift, and the
 * one that drifts is always the one guarding the write path.
 */

export class CreateStoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lower-case words separated by single hyphens',
  })
  @MaxLength(160)
  slug!: string;

  @IsString()
  @MaxLength(400)
  dek!: string;

  @IsString()
  genreSlug!: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(24)
  @IsOptional()
  tags?: string[];

  @IsEnum(StoryStatus)
  @IsOptional()
  status?: StoryStatus;

  @IsISO8601()
  @IsOptional()
  publishedAt?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  readingMinutes?: number;

  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  /**
   * Marks shipped template text. Only ever set to `true` by a fixture; the
   * admin clears it when the piece is rewritten. Exposed as a field so a
   * placeholder can be told apart from reporting without guessing at content.
   */
  @IsBoolean()
  @IsOptional()
  placeholder?: boolean;

  @IsString()
  @IsOptional()
  publication?: string;

  @IsArray()
  @IsOptional()
  body?: unknown[];
}

export class UpdateStoryDto extends VersionedUpdateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  @IsOptional()
  title?: string;

  @IsString()
  @MaxLength(400)
  @IsOptional()
  dek?: string;

  @IsString()
  @IsOptional()
  genreSlug?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(24)
  @IsOptional()
  tags?: string[];

  @IsEnum(StoryStatus)
  @IsOptional()
  status?: StoryStatus;

  @IsISO8601()
  @IsOptional()
  publishedAt?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  readingMinutes?: number;

  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  @IsBoolean()
  @IsOptional()
  placeholder?: boolean;

  @IsString()
  @IsOptional()
  publication?: string;

  @IsArray()
  @IsOptional()
  body?: unknown[];
}

export class SearchQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  q!: string;
}
