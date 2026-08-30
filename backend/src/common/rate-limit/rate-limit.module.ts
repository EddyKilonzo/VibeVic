import { Global, Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';

/**
 * Global, like `PrismaModule` and for the same reason: the limiter is
 * infrastructure that several unrelated modules reach for, and threading it
 * through each of their imports is a list that goes stale the first time
 * somebody adds a fourth caller.
 */
@Global()
@Module({
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}
