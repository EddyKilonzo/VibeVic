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
import { CreateSourceDto, UpdateSourceDto } from './source.dto';
import { SourcesService } from './sources.service';

/**
 * No `@PublicRead` anywhere in this file, and there never should be: there is
 * no public view for a Source, so a route marked public here would fail at
 * runtime rather than serve one. That is the intended relationship between the
 * two mechanisms — the guard keeps you out, and if the guard were somehow
 * bypassed the serialiser still has nothing it is willing to print.
 */
@Controller('newsroom/sources')
@NewsroomOnly()
@RequireScopes('newsroom:read')
export class SourcesController {
  constructor(private readonly sources: SourcesService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal | undefined) {
    return this.sources.list(principal);
  }

  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.sources.get(principal, id);
  }

  /**
   * The identity behind a pseudonym, on its own route so it can be given its
   * own rate limit and audit trail later without unpicking the read path.
   */
  @Get(':id/protected-identity')
  @RequireScopes('newsroom:read', 'newsroom:confidential')
  revealProtectedIdentity(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.sources.revealProtectedIdentity(principal, id);
  }

  @Post()
  @RequireScopes('newsroom:read', 'newsroom:write')
  create(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: CreateSourceDto,
  ) {
    return this.sources.create(principal, dto);
  }

  @Patch(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  update(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateSourceDto,
  ) {
    return this.sources.update(principal, id, dto);
  }

  @Delete(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  remove(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.sources.remove(principal, id);
  }
}
