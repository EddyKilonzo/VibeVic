import { Module } from '@nestjs/common';
import { AccessPolicyService } from '../../common/authz/access-policy.service';
import { AwardsAdminController, GenresAdminController } from './catalog.controller';
import { AwardsService } from './awards.service';
import { GenresService } from './genres.service';

/**
 * Awards and beats — the two published tables that had a public read and no
 * way to write.
 *
 * Their public `GET` routes stay on `CatalogController` in the stories module,
 * where they have always been, because that is the reader-facing surface and it
 * is projected through a declared public view. This module is the other half:
 * gated, scoped, and never public.
 */
@Module({
  controllers: [AwardsAdminController, GenresAdminController],
  providers: [AwardsService, GenresService, AccessPolicyService],
})
export class CatalogModule {}
