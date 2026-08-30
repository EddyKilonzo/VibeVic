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
 * PasswordService and PasswordResetService are providers but not exports.
 * Hashing a password and issuing a reset link are this module's work; a
 * feature module that found itself wanting either has taken a wrong turn, and
 * not exporting them is how that shows up as a compile error rather than as a
 * second place passwords are written.
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
  exports: [AuthService, AccessPolicyService, TOKEN_VERIFIER],
})
export class AuthModule {}
