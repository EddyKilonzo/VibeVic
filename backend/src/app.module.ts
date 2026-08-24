import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { NewsroomGuard } from './common/authz/newsroom.guard';
import { PublicSerializationInterceptor } from './common/serialization/public-serialization.interceptor';
import { validateEnv } from './config/env';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { NewsroomModule } from './modules/newsroom/newsroom.module';
import { StoriesModule } from './modules/stories/stories.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * The root module, and the place the two safety mechanisms are switched on.
 *
 * Both are registered with APP_ tokens rather than applied per controller, and
 * that is the entire reason they can be trusted. A guard listed on each
 * controller is a guard that a new controller can be written without; a guard
 * registered here applies to a route the moment the route exists, and the only
 * way out is the explicit `@PublicRead(view)` that names the projection the
 * response must pass through. Default-closed is only default-closed if the
 * default is enforced somewhere a new file cannot miss.
 *
 * Order matters between the two. The guard decides whether the request may run
 * at all; the interceptor decides what the answer is allowed to look like. Nest
 * runs guards before interceptors' response half, so a newsroom route rejected
 * at the door never reaches the serialiser, and a public route that somehow
 * returns a newsroom record is still stopped on the way out.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Every value the app reads goes through the zod schema in config/env.ts,
      // which throws rather than defaulting. A bad AUTH_MODE or a missing
      // DATABASE_URL is a refusal to boot, not a server that starts and leaks.
      validate: validateEnv,
      cache: true,
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    StoriesModule,
    NewsroomModule,
  ],
  providers: [
    // Global for the same reason the other two are: a filter listed per
    // controller is a filter the next controller is written without, and the
    // gap it leaves is a raw driver error on the wire.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: NewsroomGuard },
    { provide: APP_INTERCEPTOR, useClass: PublicSerializationInterceptor },
  ],
})
export class AppModule {}
