import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { SequencesModule } from '../sequences/sequences.module';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
  imports: [AuthModule, BillingModule, SequencesModule],
  controllers: [ContactsController],
  providers: [ContactsService],
})
export class ContactsModule {}
