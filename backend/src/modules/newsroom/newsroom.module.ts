import { Module } from '@nestjs/common';
import { MediaController } from './media/media.controller';
import { MediaService } from './media/media.service';
import { SourcesController } from './sources/sources.controller';
import { SourcesService } from './sources/sources.service';

/**
 * The newsroom surface.
 *
 * Sources came first — it is the most sensitive table in the schema and the
 * pattern the rest follow. Media is the second, and is unusual only in that the
 * files themselves live in Cloudinary: this API stores the record and the
 * delivery URL, never the bytes.
 *
 * Quotes, interviews, ideas, pitches, evidence, entities,
 * timeline, notes and deadlines all have tables and none have services yet;
 * they belong here as they are written, each with the same shape: a controller
 * that carries `@NewsroomOnly` and `@RequireScopes`, and a service that asks
 * AccessPolicyService again rather than trusting the guard got there first.
 *
 * Nothing in this module is ever `@PublicRead`, and nothing in it can be:
 * there is no public view for a source, a quote or an interview, so a route
 * here marked public would be refused by the serialiser at runtime rather than
 * quietly answered.
 */
@Module({
  controllers: [SourcesController, MediaController],
  providers: [SourcesService, MediaService],
  exports: [SourcesService, MediaService],
})
export class NewsroomModule {}
