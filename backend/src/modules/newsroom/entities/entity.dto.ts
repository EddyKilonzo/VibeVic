import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EntityKind, Visibility } from '@prisma/client';
import { VersionedUpdateDto } from '../../../common/dto/versioned-update.dto';

/**
 * An entity is a thing the reporting keeps naming — a person, a company, a
 * place, a document.
 *
 * `aliases` is a list rather than a single alternate spelling because the
 * terminology check in the editor reads all of them: a company that appears as
 * "Kenya Power", "KPLC" and "Kenya Power & Lighting" is one entity with three
 * spellings, and the check needs every one to notice the copy is inconsistent.
 */
export class CreateEntityDto {
  @IsEnum(EntityKind)
  kind!: EntityKind;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  name!: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  @IsOptional()
  aliases?: string[];

  @IsString()
  @IsOptional()
  note?: string;

  /** Defaults to PRIVATE in the service, matching the schema. */
  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;
}

export class UpdateEntityDto extends VersionedUpdateDto {
  @IsEnum(EntityKind)
  @IsOptional()
  kind?: EntityKind;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @IsOptional()
  name?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  @IsOptional()
  aliases?: string[];

  @IsString()
  @IsOptional()
  note?: string;

  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;
}
