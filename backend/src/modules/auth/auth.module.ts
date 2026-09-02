import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AccessPolicyService } from '../../common/authz/access-policy.service';
import { TOKEN_VERIFIER } from '../../common/authz/token-verifier';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { PasswordResetService } from './password-reset.service';

/**
 * Global because the guard is global: every request that is not explicitly
 * public needs a verifier, so exporting it once beats importing AuthModule into
 * every feature module and forgetting in one of them.
 *
 * JwtModule is registered with no secret on purpose — the secret is passed per
 * sign and per verify call from validated config, so there is no module-level
 * default that could quietly stand in for a missing one.
 *
 * PasswordService is a provider and not an export. Hashing a password is this
 * module's work; a feature module that found itself wanting it has taken a
 * wrong turn, and not exporting it is how that shows up as a compile error
 * rather than as a second place passwords are written.
 *
 * PasswordResetService is exported, which it was not, and the reason is worth
 * stating rather than leaving as a widened list. Account administration
 * (`SystemModule`) has to be able to send somebody their first setup link, and
 * the alternative to exporting this was a second implementation of "mint a
 * token, store its hash, email the link" — which is the exact thing both this
 * service and the CLI already warn against. One implementation, reachable by
 * the two callers that legitimately need it.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    PasswordResetService,
    AccessPolicyService,
    { provide: TOKEN_VERIFIER, useExisting: AuthService },
  ],
  exports: [AuthService, AccessPolicyService, PasswordResetService, TOKEN_VERIFIER],
})
export class AuthModule {}
