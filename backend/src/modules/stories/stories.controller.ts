import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentPrincipal, type Principal } from '../../common/authz/principal';
import {
  NewsroomOnly,
  PublicRead,
  RequireScopes,
} from '../../common/authz/surface.decorator';
import {
  AwardPublicView,
  GenrePublicView,
  PublicationPublicView,
  StoryPublicView,
  StorySummaryPublicView,
} from '../../common/serialization/views';
import { CreateStoryDto, SearchQueryDto, UpdateStoryDto } from './dto/story.dto';
import { StoriesService } from './stories.service';

/**
 * Reader-facing article routes.
 *
 * Each one names the view its output is projected through. Listings get the
 * summary view and the single-article route gets the full one — the difference
 * is enforced by the projection, not by trusting the query to have selected
 * fewer columns.
 */
@Controller('stories')
export class StoriesController {
  constructor(private readonly stories: StoriesService) {}

  @Get()
  @PublicRead(StorySummaryPublicView)
  list() {
    return this.stories.listPublished();
  }

  // Declared before ':slug' so "search" is not read as a slug.
  @Get('search')
  @PublicRead(StorySummaryPublicView)
  search(@Query() query: SearchQueryDto) {
    return this.stories.search(query.q);
  }

  @Get('genre/:genreSlug')
  @PublicRead(StorySummaryPublicView)
  byGenre(@Param('genreSlug') genreSlug: string) {
    return this.stories.byGenre(genreSlug);
  }

  @Get(':slug')
  @PublicRead(StoryPublicView)
  bySlug(@Param('slug') slug: string) {
    return this.stories.bySlug(slug);
  }
}

/** Taxonomy and credits — all public, all projected. */
@Controller()
export class CatalogController {
  constructor(private readonly stories: StoriesService) {}

  @Get('genres')
  @PublicRead(GenrePublicView)
  genres() {
    return this.stories.genres();
  }

  @Get('publications')
  @PublicRead(PublicationPublicView)
  publications() {
    return this.stories.publications();
  }

  @Get('awards')
  @PublicRead(AwardPublicView)
  awards() {
    return this.stories.awards();
  }
}

/**
 * The admin surface. `@NewsroomOnly` is what the guard would assume anyway; it
 * is written out because a reader of this file should not have to know the
 * default to know the answer.
 *
 * Responses here are raw rows, not public views — that is the difference
 * between the two surfaces, and why the guard runs before anything else.
 */
@Controller('admin/stories')
@NewsroomOnly()
@RequireScopes('stories:write')
export class StoriesAdminController {
  constructor(private readonly stories: StoriesService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal | undefined) {
    return this.stories.listAll(principal);
  }

  @Get(':id')
  byId(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.stories.byId(principal, id);
  }

  @Post()
  create(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: CreateStoryDto,
  ) {
    return this.stories.create(principal, dto);
  }

  /** PATCH, and it carries `expectedUpdatedAt`. A stale write gets a 409. */
  @Patch(':id')
  update(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateStoryDto,
  ) {
    return this.stories.update(principal, id, dto);
  }

  @Post(':id/publish')
  publish(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.stories.publish(principal, id);
  }
}
