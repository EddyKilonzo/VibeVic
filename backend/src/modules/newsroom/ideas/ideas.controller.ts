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
import { NewsroomOnly, RequireScopes } from '../../../common/authz/surface.decorator';
import { CreateIdeaDto, UpdateIdeaDto } from './idea.dto';
import { IdeasService } from './ideas.service';

/**
 * Ideas are private in whole. Nothing here is, or can be, `@PublicRead`.
 *
 * `newsroom:ideas` sits on the class, so it applies to reads as well as
 * writes. That is the difference between this collection and every other one:
 * elsewhere the question is what a principal may change, here it is whether
 * they may look at all. An idea is the decision to write something, taken and
 * not yet acted on, and it belongs to the person taking it.
 */
@Controller('newsroom/ideas')
@NewsroomOnly()
@RequireScopes('newsroom:read', 'newsroom:ideas')
export class IdeasController {
  constructor(private readonly ideas: IdeasService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal | undefined) {
    return this.ideas.list(principal);
  }

  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.ideas.get(principal, id);
  }

  @Post()
  @RequireScopes('newsroom:read', 'newsroom:write', 'newsroom:ideas')
  create(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: CreateIdeaDto,
  ) {
    return this.ideas.create(principal, dto);
  }

  @Patch(':id')
  @RequireScopes('newsroom:read', 'newsroom:write', 'newsroom:ideas')
  update(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateIdeaDto,
  ) {
    return this.ideas.update(principal, id, dto);
  }

  @Delete(':id')
  @RequireScopes('newsroom:read', 'newsroom:write', 'newsroom:ideas')
  remove(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.ideas.remove(principal, id);
  }
}
