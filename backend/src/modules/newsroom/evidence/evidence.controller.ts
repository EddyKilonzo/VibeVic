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
import { CreateEvidenceDto, UpdateEvidenceDto } from './evidence.dto';
import { EvidenceService } from './evidence.service';

/**
 * What backs a claim up. Links to entities and to the source that supplied it, and the service filters both by what the caller may know about.
 */
@Controller('newsroom/evidence')
@NewsroomOnly()
@RequireScopes('newsroom:read')
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal | undefined) {
    return this.evidence.list(principal);
  }

  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.evidence.get(principal, id);
  }

  @Post()
  @RequireScopes('newsroom:read', 'newsroom:write')
  create(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: CreateEvidenceDto,
  ) {
    return this.evidence.create(principal, dto);
  }

  @Patch(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  update(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateEvidenceDto,
  ) {
    return this.evidence.update(principal, id, dto);
  }

  @Delete(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  remove(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.evidence.remove(principal, id);
  }
}
