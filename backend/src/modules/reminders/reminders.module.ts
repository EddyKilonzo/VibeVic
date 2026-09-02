import { Module } from '@nestjs/common';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

/**
 * The mail the newsroom sends without being asked, and the one route that
 * triggers it.
 *
 * Its own module rather than a corner of SystemModule, because SystemModule is
 * explicitly "the two capabilities the DEV role holds and the WRITER role does
 * not" — and this is neither. It is the writer's own mail, run by a scheduler
 * that is nobody at all.
 */
@Module({
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
