import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { VersionedUpdateDto } from '../../common/dto/versioned-update.dto';

/**
 * The catalog: awards and beats.
 *
 * Both are published content rather than newsroom records — an award is a
 * credential the site states in public, a beat is the taxonomy every story is
 * filed against — so they carry no `visibility` and sit behind `stories:write`
 * rather than the newsroom scopes.
 */

/**
 * The four results, spelled once.
 *
 * `Award.result` is a plain string in the schema, which is the right column
 * type and the wrong place to stop: without this the API would accept
 * "runner up", "Runner-up" and "WINNER" as three distinct results and the
 * public page would render whichever arrived. The frontend has offered exactly
 * these four since the screen was written; this is the same list, enforced.
 */
export const AWARD_RESULTS = [
  'Winner',
  'Finalist',
  'Shortlisted',
  'Honourable mention',
] as const;

export class CreateAwardDto {
  /**
   * A year, as a string.
   *
   * Kept a string because awards are cited as "2019" and occasionally
   * "2019/20", and a number column would quietly lose the second. Four digits
   * with an optional second year is the whole grammar.
   */
  @IsString()
  @Matches(/^\d{4}(\/\d{2,4})?$/, {
    message: 'year must be a four-digit year, optionally as 2019/20.',
  })
  year!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  /** The awarding body. Named `body` in the schema; not the prose. */
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  body!: string;

  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsIn(AWARD_RESULTS as unknown as string[], {
    message: `result must be one of: ${AWARD_RESULTS.join(', ')}.`,
  })
  result!: string;
}

export class UpdateAwardDto extends VersionedUpdateDto {
  @IsString()
  @Matches(/^\d{4}(\/\d{2,4})?$/, {
    message: 'year must be a four-digit year, optionally as 2019/20.',
  })
  @IsOptional()
  year?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @IsOptional()
  title?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @IsOptional()
  body?: string;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @IsIn(AWARD_RESULTS as unknown as string[], {
    message: `result must be one of: ${AWARD_RESULTS.join(', ')}.`,
  })
  @IsOptional()
  result?: string;
}

/**
 * The slug pattern, matching the one `CreateStoryDto` enforces.
 *
 * A beat's slug is its primary key *and* the foreign key on every story filed
 * under it, so it has to be a legal path segment and it has to be stable.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateGenreDto {
  @IsString()
  @Matches(SLUG, {
    message: 'slug must be lower-case words separated by single hyphens',
  })
  @MaxLength(64)
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(500)
  description!: string;

  /**
   * The beat this one sits under, or nothing for a top-level beat.
   *
   * One level only. `Genre.parent` is a real foreign key so the database
   * refuses a parent that does not exist; what it cannot refuse on its own is a
   * *second* level, and `data/types` is explicit that the taxonomy is two deep
   * and nothing should add a third. The service checks it.
   */
  @IsString()
  @Matches(SLUG)
  @IsOptional()
  parentSlug?: string;
}

export class UpdateGenreDto extends VersionedUpdateDto {
  /**
   * No slug, deliberately.
   *
   * It is the primary key and the foreign key every story carries, so renaming
   * it would either orphan the archive or cascade a URL change across every
   * published piece filed under it. `UpdateStoryDto` omits its slug for the
   * same reason and says so there: an address readers have saved is not an
   * editable field.
   */
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;

  /** Null clears it, promoting the beat to the top level. */
  @IsString()
  @Matches(SLUG)
  @IsOptional()
  parentSlug?: string | null;
}
