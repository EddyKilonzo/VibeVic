import { Module } from '@nestjs/common';
import {
  CatalogController,
  StoriesAdminController,
  StoriesController,
} from './stories.controller';
import { StoriesService } from './stories.service';

@Module({
  controllers: [StoriesController, CatalogController, StoriesAdminController],
  providers: [StoriesService],
  exports: [StoriesService],
})
export class StoriesModule {}
