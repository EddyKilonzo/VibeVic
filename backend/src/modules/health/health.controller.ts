import { Controller, Get } from '@nestjs/common';
import { PublicRead } from '../../common/authz/surface.decorator';
import { HealthPublicView, type PublicHealth } from '../../common/serialization/views';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Public, and intentionally thin. Health endpoints have a habit of growing
   * into a debugging console — version strings, migration state, queue depth —
   * and every addition is another unauthenticated fact about the deployment.
   * The declared view is what stops that drift silently succeeding.
   */
  @Get()
  @PublicRead(HealthPublicView)
  check(): Promise<PublicHealth> {
    return this.health.check();
  }
}
