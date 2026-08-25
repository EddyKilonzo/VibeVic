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
import { CreateInterviewDto, UpdateInterviewDto } from './interview.dto';
import { InterviewsService } from './interviews.service';

/**
 * Confidential by default, so an unscoped principal gets a list that does not know the hidden rows exist rather than a shorter list with gaps in it.
 */
@Controller('newsroom/interviews')
@NewsroomOnly()
@RequireScopes('newsroom:read')
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal | undefined) {
    return this.interviews.list(principal);
  }

  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.interviews.get(principal, id);
  }

  @Post()
  @RequireScopes('newsroom:read', 'newsroom:write')
  create(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: CreateInterviewDto,
  ) {
    return this.interviews.create(principal, dto);
  }

  @Patch(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  update(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateInterviewDto,
  ) {
    return this.interviews.update(principal, id, dto);
  }

  @Delete(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  remove(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.interviews.remove(principal, id);
  }
}
