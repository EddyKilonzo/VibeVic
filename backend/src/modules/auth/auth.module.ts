import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AccessPolicyService } from '../../common/authz/access-policy.service';
import { TOKEN_VERIFIER } from '../../common/authz/token-verifier';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * Global because the guard is global: every request that is not explicitly
 * public needs a verifier, so exporting it once beats importing AuthModule into
 * every feature module and forgetting in one of them.
 *
 * JwtModule is registered with no secret on purpose — the secret is passed per
 * verify call from validated config, so there is no module-level default that
 * could quietly stand in for a missing one.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessPolicyService,
    { provide: TOKEN_VERIFIER, useExisting: AuthService },
  ],
  exports: [AuthService, AccessPolicyService, TOKEN_VERIFIER],
})
export class AuthModule {}
