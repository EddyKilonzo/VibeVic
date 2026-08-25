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
import { CreateQuoteDto, UpdateQuoteDto } from './quote.dto';
import { QuotesService } from './quotes.service';

/**
 * Quotes carry their own visibility, so unlike ideas the list this returns
 * differs by who is asking. There is still no `newsroom:confidential` on the
 * class: that scope widens what comes back, it does not gate the door.
 */
@Controller('newsroom/quotes')
@NewsroomOnly()
@RequireScopes('newsroom:read')
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal | undefined) {
    return this.quotes.list(principal);
  }

  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.quotes.get(principal, id);
  }

  @Post()
  @RequireScopes('newsroom:read', 'newsroom:write')
  create(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: CreateQuoteDto,
  ) {
    return this.quotes.create(principal, dto);
  }

  @Patch(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  update(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateQuoteDto,
  ) {
    return this.quotes.update(principal, id, dto);
  }

  @Delete(':id')
  @RequireScopes('newsroom:read', 'newsroom:write')
  remove(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param('id') id: string,
  ) {
    return this.quotes.remove(principal, id);
  }
}
