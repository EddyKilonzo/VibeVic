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
  IsUrl,
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

  /**
   * Canonical home of a syndicated piece. @IsUrl because this is by definition
   * an address somewhere else — a relative path here would be a copy claiming
   * to be its own original.
   */
  @IsUrl()
  @IsOptional()
  sourceUrl?: string;

  /**
   * Cover photograph. A plain string rather than @IsUrl: today every cover is
   * an absolute URL from the import, but an uploaded file will be a site-
   * relative path, and a validator that rejects it would be found the hard way.
   */
  @IsString()
  @MaxLength(2048)
  @IsOptional()
  cover?: string;

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

  /**
   * Canonical home of a syndicated piece. @IsUrl because this is by definition
   * an address somewhere else — a relative path here would be a copy claiming
   * to be its own original.
   */
  @IsUrl()
  @IsOptional()
  sourceUrl?: string;

  /**
   * Cover photograph. A plain string rather than @IsUrl: today every cover is
   * an absolute URL from the import, but an uploaded file will be a site-
   * relative path, and a validator that rejects it would be found the hard way.
   */
  @IsString()
  @MaxLength(2048)
  @IsOptional()
  cover?: string;

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

/**
 * What the publish route is being asked to do.
 *
 * One route with three verbs rather than three routes, because all three are
 * the same decision — where this piece sits relative to the public — and
 * splitting them would mean three places that have to agree about the
 * canonical check and the date rule.
 *
 * The body is optional, and an absent one means `publish`. That keeps the
 * call the editor already makes working unchanged: it posts to `/publish`
 * with nothing in it and means the obvious thing.
 */
export const PUBLISH_ACTIONS = ['publish', 'schedule', 'unpublish'] as const;
export type PublishAction = (typeof PUBLISH_ACTIONS)[number];

export class PublishStoryDto {
  @IsEnum(PUBLISH_ACTIONS)
  @IsOptional()
  action?: PublishAction;

  /**
   * When a scheduled piece should appear. Required by `schedule` and refused
   * by the other two — a date on an un-publish would be a instruction nobody
   * could act on, and silently ignoring it is how a writer ends up believing
   * they scheduled something.
   *
   * Validated as a real instant here and as a *future* instant in the service,
   * because "is this in the future" is a question about the clock at the
   * moment of the write, not about the shape of the string.
   */
  @IsISO8601()
  @IsOptional()
  publishAt?: string;
}
