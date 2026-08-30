import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Global for the same reason AuthModule is: mail is a cross-cutting facility
 * rather than one feature's private dependency, and the alternative is
 * importing it into every module that ever needs to tell somebody something.
 */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
