import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PortfolioClass } from '@prisma/client';
import { VersionedUpdateDto } from '../../../common/dto/versioned-update.dto';

/**
 * Curation: the two pieces of newsroom state the journalist chose to make
 * visible, plus the house style that shapes the copy.
 *
 * `storyIds` on a collection is the one list in this codebase where order is
 * data rather than presentation — the order *is* the curation, which is why it
 * is stored as `CollectionStory.position` and must survive a round trip. Every
 * other id list in the newsroom is a set, and `linkDiff` collapses duplicates
 * in those precisely because they are sets. Here a repeat would be a genuine
 * mistake, so the service rejects one rather than quietly deduplicating and
 * shifting everything after it.
 */
export class CreateCollectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(500)
  @IsOptional()
  storyIds?: string[];

  @IsString()
  @IsOptional()
  coverStoryId?: string;
}

export class UpdateCollectionDto extends VersionedUpdateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  /** Absent leaves the running order alone; a list replaces it wholesale. */
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(500)
  @IsOptional()
  storyIds?: string[];

  @IsString()
  @IsOptional()
  coverStoryId?: string | null;
}

/** How the journalist rates one piece. Deliberately not derived from traffic. */
export class SetPortfolioClassDto {
  @IsEnum(PortfolioClass)
  class!: PortfolioClass;
}

export class StyleGuideEntryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  preferred!: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  @IsOptional()
  avoid?: string[];

  @IsString()
  @IsOptional()
  why?: string;
}

/**
 * The whole style guide, replaced in one call.
 *
 * Per-entry CRUD would be tidier REST and worse for the job. The guide is
 * edited as a document — a journalist reorders it, merges two entries, deletes
 * one and adds another in a single sitting — and a screen that had to emit five
 * requests to save that would leave the guide half-written whenever one failed.
 */
/**
 * The scratchpad's whole text.
 *
 * One field, and it may be empty — clearing the pad is a thing somebody does
 * on purpose, so an empty string has to be a legal value rather than a
 * validation failure. `@IsString` without `@MinLength` is what says that.
 *
 * The cap is generous because this is where long thinking goes, and a limit a
 * writer can reach mid-sentence is worse than no pad at all. It exists only so
 * that a runaway client cannot post a megabyte.
 */
export class SetScratchpadDto {
  @IsString()
  @MaxLength(100_000)
  body!: string;
}

export class SetStyleGuideDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StyleGuideEntryDto)
  @ArrayMaxSize(1000)
  entries!: StyleGuideEntryDto[];
}
