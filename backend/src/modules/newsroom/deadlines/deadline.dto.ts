import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { VersionedUpdateDto } from '../../../common/dto/versioned-update.dto';

/**
 * A date something is due.
 *
 * `dueAt` is required and is a full datetime rather than a date: "Friday" and
 * "Friday 6pm" are different promises, and a filing deadline that lost its time
 * of day would show as met by a piece sent at midnight.
 */
export class CreateDeadlineDto {
  @IsString()
  @IsOptional()
  storyId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  label!: string;

  @IsISO8601()
  dueAt!: string;

  @IsBoolean()
  @IsOptional()
  done?: boolean;
}

export class UpdateDeadlineDto extends VersionedUpdateDto {
  @IsString()
  @IsOptional()
  storyId?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @IsOptional()
  label?: string;

  @IsISO8601()
  @IsOptional()
  dueAt?: string;

  @IsBoolean()
  @IsOptional()
  done?: boolean;
}
