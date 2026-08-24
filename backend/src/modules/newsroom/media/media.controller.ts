import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentPrincipal, type Principal } from '../../../common/authz/principal';
import {
  NewsroomOnly,
  RequireScopes,
} from '../../../common/authz/surface.decorator';
import { CreateMediaDto, UpdateMediaDto } from './media.dto';
import { MediaService } from './media.service';

/**
 * The media library, behind the newsroom door like everything else here.
 *
 * No upload endpoint, deliberately. The bytes go from the browser straight to
 * Cloudinary against a signature minted by the Next server; this API only ever
 * handles the record of the file. That keeps three things true: no request to
 * this service carries a multi-megabyte body, the Cloudinary secret is not in
 * this process, and the library survives the browser it was uploaded from.
 *
 * The delivered URLs are public once a picture is on a published story — that
 * is what a cover image is — but the *library* is not. Knowing every asset the
 * newsroom holds, including ones attached to unpublished work, is a newsroom
 * fact, so listing requires the read scope.
 */
@Controller('newsroom/media')
@NewsroomOnly()
@RequireScopes('newsroom:read')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal | undefined) {
    return this.media.list(principal);
  }

  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.media.get(principal, id);
  }

  /** Records a file the browser has already sent to Cloudinary. */
  @Post()
  @RequireScopes('newsroom:read', 'newsroom:write')
  create(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: CreateMediaDto,
  ) {
    return this.media.create(principal, dto);
  }

  /** Name and alt text only — see UpdateMediaDto. */
  @Patch(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  update(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateMediaDto,
  ) {
    return this.media.update(principal, id, dto);
  }

  @Delete(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  remove(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.media.remove(principal, id);
  }
}
