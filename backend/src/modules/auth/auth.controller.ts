import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentPrincipal, type Principal } from '../../common/authz/principal';
import { AccessPolicyService } from '../../common/authz/access-policy.service';
import { NewsroomOnly } from '../../common/authz/surface.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly policy: AccessPolicyService,
  ) {}

  /**
   * Login is deliberately *not* marked `@PublicRead`, even though a real login
   * would have to be reachable without a token. Marking it public now would
   * open an unauthenticated route into a code path that does not exist yet;
   * whoever implements issuance gets to make that change knowingly.
   */
  @Post('token')
  @NewsroomOnly()
  async token(@Body() credentials: LoginDto): Promise<never> {
    return this.auth.issueToken(credentials);
  }

  /** Echoes back what the server believes about the caller. */
  @Get('me')
  @NewsroomOnly()
  me(@CurrentPrincipal() principal: Principal | undefined): {
    id: string;
    email: string;
    scopes: readonly string[];
  } {
    const authenticated = this.policy.requirePrincipal(principal);
    return {
      id: authenticated.id,
      email: authenticated.email,
      scopes: authenticated.scopes,
    };
  }
}
