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
import { CreateEntityDto, UpdateEntityDto } from './entity.dto';
import { EntitiesService } from './entities.service';

/**
 * The people, organisations and documents a story keeps naming. Tiered like the rest, though in practice most entities are PRIVATE rather than confidential — a company name is rarely the secret.
 */
@Controller('newsroom/entities')
@NewsroomOnly()
@RequireScopes('newsroom:read')
export class EntitiesController {
  constructor(private readonly entities: EntitiesService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal | undefined) {
    return this.entities.list(principal);
  }

  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.entities.get(principal, id);
  }

  @Post()
  @RequireScopes('newsroom:read', 'newsroom:write')
  create(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: CreateEntityDto,
  ) {
    return this.entities.create(principal, dto);
  }

  @Patch(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  update(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateEntityDto,
  ) {
    return this.entities.update(principal, id, dto);
  }

  @Delete(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  remove(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.entities.remove(principal, id);
  }
}
