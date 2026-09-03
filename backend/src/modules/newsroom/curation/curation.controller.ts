import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentPrincipal, type Principal } from '../../../common/authz/principal';
import { NewsroomOnly, RequireScopes } from '../../../common/authz/surface.decorator';
import {
  CreateCollectionDto,
  SetPortfolioClassDto,
  SetScratchpadDto,
  SetStyleGuideDto,
  UpdateCollectionDto,
} from './curation.dto';
import { CurationService } from './curation.service';

/**
 * Collections — ordered sets of published work.
 *
 * Newsroom-only for now even though collections are one of the two things the
 * frontend's `toPublicPayload` is willing to publish. A public route needs a
 * declared view in `views.ts` or the serialiser refuses it outright, and no
 * reader-facing screen renders collections yet. Writing the route first would
 * mean either a view with nothing to project or a 500 waiting to be found.
 */
@Controller('newsroom/collections')
@NewsroomOnly()
@RequireScopes('newsroom:read')
export class CollectionsController {
  constructor(private readonly curation: CurationService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal | undefined) {
    return this.curation.listCollections(principal);
  }

  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.curation.getCollection(principal, id);
  }

  @Post()
  @RequireScopes('newsroom:read', 'newsroom:write')
  create(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: CreateCollectionDto,
  ) {
    return this.curation.createCollection(principal, dto);
  }

  @Patch(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  update(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto,
  ) {
    return this.curation.updateCollection(principal, id, dto);
  }

  @Delete(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  remove(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.curation.removeCollection(principal, id);
  }
}

/**
 * Portfolio classes — how the journalist rates a piece.
 *
 * PUT rather than POST, and keyed by story id rather than an id of its own: the
 * class is a property of the story, so setting it twice is the same statement
 * made twice, not two records. That makes it idempotent, which is what PUT is
 * for and what a retry after a dropped connection needs.
 */
@Controller('newsroom/portfolio')
@NewsroomOnly()
@RequireScopes('newsroom:read')
export class PortfolioController {
  constructor(private readonly curation: CurationService) {}

  /** A map keyed by story id, matching the shape the workspace holds. */
  @Get()
  all(@CurrentPrincipal() principal: Principal | undefined) {
    return this.curation.portfolio(principal);
  }

  @Put(':storyId')
  @RequireScopes('newsroom:read', 'newsroom:write')
  set(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('storyId') storyId: string,
    @Body() dto: SetPortfolioClassDto,
  ) {
    return this.curation.setPortfolioClass(principal, storyId, dto.class);
  }

  @Delete(':storyId')
  @RequireScopes('newsroom:read', 'newsroom:write')
  clear(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('storyId') storyId: string,
  ) {
    return this.curation.clearPortfolioClass(principal, storyId);
  }
}

/**
 * The scratchpad, read and replaced as one document.
 *
 * PUT with no id, because there is exactly one pad. The same argument the
 * portfolio controller makes for keying on a story id applies harder here:
 * saving the pad twice is one statement made twice, not two pads, so the verb
 * has to be idempotent — which matters more than usual because this route is
 * called by an autosave that will retry.
 */
@Controller('newsroom/scratchpad')
@NewsroomOnly()
@RequireScopes('newsroom:read')
export class ScratchpadController {
  constructor(private readonly curation: CurationService) {}

  @Get()
  read(@CurrentPrincipal() principal: Principal | undefined) {
    return this.curation.scratchpad(principal);
  }

  @Put()
  @RequireScopes('newsroom:read', 'newsroom:write')
  replace(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: SetScratchpadDto,
  ) {
    return this.curation.setScratchpad(principal, dto);
  }
}

/**
 * The house style guide, read and replaced as one document.
 *
 * There is no per-entry route on purpose — see `SetStyleGuideDto`. A guide is
 * edited in one sitting and saved once, and five requests that can half-fail
 * are a worse model of that than one that cannot.
 */
@Controller('newsroom/style-guide')
@NewsroomOnly()
@RequireScopes('newsroom:read')
export class StyleGuideController {
  constructor(private readonly curation: CurationService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal | undefined) {
    return this.curation.styleGuide(principal);
  }

  @Put()
  @RequireScopes('newsroom:read', 'newsroom:write')
  replace(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: SetStyleGuideDto,
  ) {
    return this.curation.setStyleGuide(principal, dto);
  }
}
