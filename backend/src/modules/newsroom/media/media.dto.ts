import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MediaKind, MediaSource } from '@prisma/client';
import { VersionedUpdateDto } from '../../../common/dto/versioned-update.dto';

/**
 * Recording an asset the browser has already uploaded.
 *
 * The bytes never pass through this API — the newsroom signs an upload and the
 * browser sends the file straight to Cloudinary, so what arrives here is the
 * receipt. That means every field below is client-supplied and none of it can
 * be trusted on arrival: `url` is checked to be a URL, `publicId` to be a
 * plausible id, and the service re-derives nothing it can avoid re-deriving.
 */
export class CreateMediaDto {
  @IsEnum(MediaKind)
  kind!: MediaKind;

  @IsEnum(MediaSource)
  @IsOptional()
  source?: MediaSource;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  name!: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  alt?: string;

  /**
   * Cloudinary's id for the file. Required for an upload and refused for a
   * link — enforced in the service, because the rule is about the relationship
   * between two fields rather than either one on its own.
   */
  @IsString()
  @MaxLength(300)
  @IsOptional()
  publicId?: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  url!: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  bytes?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  width?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  height?: number;

  @IsString()
  @MaxLength(20)
  @IsOptional()
  format?: string;
}

/**
 * Only the two fields worth editing after the fact.
 *
 * Not the url, the public id or the dimensions: those describe the file that
 * was uploaded, and letting a client rewrite them would let a row point at one
 * asset while claiming the size and shape of another.
 */
export class UpdateMediaDto extends VersionedUpdateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  alt?: string;
}
