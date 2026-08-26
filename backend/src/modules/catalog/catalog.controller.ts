import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentPrincipal, type Principal } from '../../common/authz/principal';
import { NewsroomOnly, RequireScopes } from '../../common/authz/surface.decorator';
import {
  CreateAwardDto,
  CreateGenreDto,
  UpdateAwardDto,
  UpdateGenreDto,
} from './catalog.dto';
import { AwardsService } from './awards.service';
import { GenresService } from './genres.service';

/**
 * The admin surface for the catalog.
 *
 * ── Why these are not under `/admin` with the stories ────────────────────
 * They sit under `/newsroom` because that is the prefix the frontend's proxy
 * and middleware already cover — `/api/newsroom/:path*` is the matcher, and a
 * route outside it would be one the gate does not know about. The scope is
 * `stories:write` rather than the newsroom scopes, because an award and a beat
 * are published content: neither carries a `visibility`, and both end up on a
 * page a reader can see.
 */

@Controller('newsroom/awards')
@NewsroomOnly()
@RequireScopes('stories:write')
export class AwardsAdminController {
  constructor(private readonly awards: AwardsService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal | undefined) {
    return this.awards.list(principal);
  }

  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.awards.get(principal, id);
  }

  @Post()
  create(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: CreateAwardDto,
  ) {
    return this.awards.create(principal, dto);
  }

  /** PATCH, and it carries `expectedUpdatedAt`. A stale write gets a 409. */
  @Patch(':id')
  update(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateAwardDto,
  ) {
    return this.awards.update(principal, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.awards.remove(principal, id);
  }
}

/**
 * Beats.
 *
 * Keyed by slug rather than an id of its own, because that is what the table
 * is keyed by and what every story carries. The consequence is visible in the
 * routes — `:slug`, not `:id` — and in `UpdateGenreDto`, which has no slug
 * field at all: a beat's address is fixed once anything is filed under it.
 */
@Controller('newsroom/genres')
@NewsroomOnly()
@RequireScopes('stories:write')
export class GenresAdminController {
  constructor(private readonly genres: GenresService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal | undefined) {
    return this.genres.list(principal);
  }

  @Get(':slug')
  get(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('slug') slug: string,
  ) {
    return this.genres.get(principal, slug);
  }

  @Post()
  create(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: CreateGenreDto,
  ) {
    return this.genres.create(principal, dto);
  }

  @Patch(':slug')
  update(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('slug') slug: string,
    @Body() dto: UpdateGenreDto,
  ) {
    return this.genres.update(principal, slug, dto);
  }

  @Delete(':slug')
  remove(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('slug') slug: string,
  ) {
    return this.genres.remove(principal, slug);
  }
}
