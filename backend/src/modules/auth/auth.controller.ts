import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentPrincipal, type Principal } from '../../common/authz/principal';
import { AccessPolicyService } from '../../common/authz/access-policy.service';
import { NewsroomOnly, PublicRead } from '../../common/authz/surface.decorator';
import {
  AcceptedPublicView,
  SessionPublicView,
  type PublicAccepted,
  type PublicSession,
} from '../../common/serialization/views';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

/**
 * The three unauthenticated routes in this API, and one that is not.
 *
 * ── The comment that used to be here, and why it is gone ─────────────────
 * `POST /auth/token` was marked `@NewsroomOnly`, with a note saying that a
 * real login would have to be reachable without a token but that opening it
 * now would expose a code path that did not exist. The code path exists, so
 * the door opens — and it opens the way the rest of this codebase opens
 * doors: `@PublicRead(view)`, which names the projection the answer must pass
 * through before it reaches the wire. Three public routes is a real widening
 * of the attack surface, and each one carries its own throttle, its own
 * uniform failure message, and a view that cannot leak a record.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly resets: PasswordResetService,
    private readonly policy: AccessPolicyService,
  ) {}

  /** Email and password in, a session out. Every failure is one 401. */
  @Post('token')
  @HttpCode(200)
  @PublicRead(SessionPublicView)
  async token(@Body() credentials: LoginDto): Promise<PublicSession> {
    return this.auth.issueToken(credentials);
  }

  /**
   * Ask for a reset link. Always 202, never a hint about the address.
   *
   * 202 rather than 200 on purpose: the server has accepted the request and
   * will act on it if there is anything to act on, and it is not claiming an
   * email was sent. That is the literal truth of what happened, and it is
   * also the only answer that does not distinguish a known address from an
   * unknown one.
   */
  @Post('forgot-password')
  @HttpCode(202)
  @PublicRead(AcceptedPublicView)
  async forgot(
    @Body() body: ForgotPasswordDto,
    @Req() request: Request,
  ): Promise<PublicAccepted> {
    await this.resets.request(body.email, callerAddress(request));
    return { accepted: true };
  }

  /** Spend a link and set a new password. Ends every existing session. */
  @Post('reset-password')
  @HttpCode(200)
  @PublicRead(AcceptedPublicView)
  async reset(@Body() body: ResetPasswordDto): Promise<PublicAccepted> {
    await this.resets.reset(body.token, body.password);
    return { accepted: true };
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

/**
 * Who asked, as far as anyone can tell.
 *
 * Spoofable, and that is fine, because nothing is decided with it: it is
 * stored on the reset row so that a burst of requests against one account is
 * visible to a person reading the table afterwards. A header a caller writes
 * must never gate a caller's access, and this one does not.
 */
function callerAddress(request: Request): string | null {
  const forwarded = request.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const address = first?.split(',')[0]?.trim() || request.ip;
  return address ?? null;
}
