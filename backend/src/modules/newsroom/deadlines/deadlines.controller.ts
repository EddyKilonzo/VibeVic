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
import { CreateDeadlineDto, UpdateDeadlineDto } from './deadline.dto';
import { DeadlinesService } from './deadlines.service';

/**
 * Dates work is due. No visibility column and nothing sensitive in the row, but it is newsroom state and belongs behind the same door as everything else.
 */
@Controller('newsroom/deadlines')
@NewsroomOnly()
@RequireScopes('newsroom:read')
export class DeadlinesController {
  constructor(private readonly deadlines: DeadlinesService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal | undefined) {
    return this.deadlines.list(principal);
  }

  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.deadlines.get(principal, id);
  }

  @Post()
  @RequireScopes('newsroom:read', 'newsroom:write')
  create(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: CreateDeadlineDto,
  ) {
    return this.deadlines.create(principal, dto);
  }

  @Patch(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  update(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateDeadlineDto,
  ) {
    return this.deadlines.update(principal, id, dto);
  }

  @Delete(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  remove(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.deadlines.remove(principal, id);
  }
}
