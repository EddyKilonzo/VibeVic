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
import { CreateTimelineEventDto, UpdateTimelineEventDto } from './timeline.dto';
import { TimelineService } from './timeline.service';

/**
 * What happened when. The table carries no visibility of its own, but it points at entities and evidence that do, so the linked ids are filtered even though the row never is.
 */
@Controller('newsroom/timeline')
@NewsroomOnly()
@RequireScopes('newsroom:read')
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal | undefined) {
    return this.timeline.list(principal);
  }

  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.timeline.get(principal, id);
  }

  @Post()
  @RequireScopes('newsroom:read', 'newsroom:write')
  create(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: CreateTimelineEventDto,
  ) {
    return this.timeline.create(principal, dto);
  }

  @Patch(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  update(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateTimelineEventDto,
  ) {
    return this.timeline.update(principal, id, dto);
  }

  @Delete(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  remove(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.timeline.remove(principal, id);
  }
}
