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
import { CreateNoteDto, UpdateNoteDto } from './note.dto';
import { NotesService } from './notes.service';

/**
 * Working notes. PRIVATE by default rather than confidential: these are the journalist's own thinking, not somebody else's identity.
 */
@Controller('newsroom/notes')
@NewsroomOnly()
@RequireScopes('newsroom:read')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal | undefined) {
    return this.notes.list(principal);
  }

  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.notes.get(principal, id);
  }

  @Post()
  @RequireScopes('newsroom:read', 'newsroom:write')
  create(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: CreateNoteDto,
  ) {
    return this.notes.create(principal, dto);
  }

  @Patch(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  update(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notes.update(principal, id, dto);
  }

  @Delete(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  remove(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.notes.remove(principal, id);
  }
}
