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
 * One thing that happened, and when.
 *
 * `occurredAt` is required and is the date of the event itself, never the date
 * of the note about it. The two drift apart constantly — a document surfaces in
 * March describing a meeting the previous August — and a timeline that recorded
 * the second date would put the story in the wrong order, which is the one job
 * a timeline has.
 */
export class CreateTimelineEventDto {
  @IsISO8601()
  occurredAt!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  what!: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  entityIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  evidenceIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  storyIds?: string[];
}

export class UpdateTimelineEventDto extends VersionedUpdateDto {
  @IsISO8601()
  @IsOptional()
  occurredAt?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @IsOptional()
  what?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  entityIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  evidenceIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  storyIds?: string[];
}
