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

/** Ideas are private in whole. Nothing here is, or can be, `@PublicRead`. */
@Controller('newsroom/ideas')
@NewsroomOnly()
@RequireScopes('newsroom:read')
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
  @RequireScopes('newsroom:read', 'newsroom:write')
  create(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: CreateIdeaDto,
  ) {
    return this.ideas.create(principal, dto);
  }

  @Patch(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  update(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateIdeaDto,
  ) {
    return this.ideas.update(principal, id, dto);
  }

  @Delete(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  remove(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.ideas.remove(principal, id);
  }
}
