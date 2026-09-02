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
import { CreatePitchDto, UpdatePitchDto } from './pitch.dto';
import { PitchesService } from './pitches.service';

/**
 * Pitches are private in whole, like ideas — and gated the same way, on
 * `newsroom:ideas` rather than on `newsroom:read`. A pitch is an idea that has
 * been worked up; if the notebook is the writer's, so is this.
 *
 * The scopes on this controller look identical to the sources controller and do
 * not mean quite the same thing: `newsroom:confidential` is not required to
 * read a pitch, because a pitch itself is not confidential. What that scope
 * changes here is how much of a pitch you are shown — the service decides which
 * linked sources you are allowed to know about. Authorisation to open the
 * record and authorisation to see all of it are separate questions, and this is
 * the one place in the newsroom where they have different answers.
 */
@Controller('newsroom/pitches')
@NewsroomOnly()
@RequireScopes('newsroom:read', 'newsroom:ideas')
export class PitchesController {
  constructor(private readonly pitches: PitchesService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal | undefined) {
    return this.pitches.list(principal);
  }

  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.pitches.get(principal, id);
  }

  @Post()
  @RequireScopes('newsroom:read', 'newsroom:write', 'newsroom:ideas')
  create(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: CreatePitchDto,
  ) {
    return this.pitches.create(principal, dto);
  }

  @Patch(':id')
  @RequireScopes('newsroom:read', 'newsroom:write', 'newsroom:ideas')
  update(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
    @Body() dto: UpdatePitchDto,
  ) {
    return this.pitches.update(principal, id, dto);
  }

  @Delete(':id')
  @RequireScopes('newsroom:read', 'newsroom:write', 'newsroom:ideas')
  remove(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.pitches.remove(principal, id);
  }
}
