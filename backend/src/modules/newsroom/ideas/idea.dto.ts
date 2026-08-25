import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IdeaStage, Priority } from '@prisma/client';
import { VersionedUpdateDto } from '../../../common/dto/versioned-update.dto';

/**
 * An idea is the cheapest record in the newsroom and the one most likely to be
 * typed in a hurry, so almost everything is optional. The title is not: an
 * untitled idea is indistinguishable from an empty row, and a list of those is
 * how a workspace stops being worth opening.
 *
 * `priority` is accepted from the client and never computed. The Ideas screen
 * is explicit that ranking a journalist's ideas is a claim software has no
 * business making, and a server that quietly scored them would be making it.
 */
export class CreateIdeaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  @IsOptional()
  tags?: string[];

  @IsString()
  @MinLength(1)
  genre!: string;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @IsEnum(IdeaStage)
  @IsOptional()
  stage?: IdeaStage;

  /** Set once the idea becomes a story. */
  @IsString()
  @IsOptional()
  storyId?: string;
}

export class UpdateIdeaDto extends VersionedUpdateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  @IsOptional()
  tags?: string[];

  @IsString()
  @MinLength(1)
  @IsOptional()
  genre?: string;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @IsEnum(IdeaStage)
  @IsOptional()
  stage?: IdeaStage;

  /**
   * Nullable on update, unlike on create: commissioning an idea attaches a
   * story, and abandoning that story has to be able to detach it again. `null`
   * and "absent" mean different things here and the service reads them apart.
   */
  @IsString()
  @IsOptional()
  storyId?: string | null;
}
