import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ContactsModule } from './contacts/contacts.module';
import { HealthController } from './health.controller';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma.module';
import { TemplatesModule } from './templates/templates.module';
import { UnsubscribeModule } from './unsubscribe/unsubscribe.module';
import { MailWebhooksModule } from './webhooks/mail/mail-webhooks.module';
import { SequencesModule } from './sequences/sequences.module';
import { BillingModule } from './billing/billing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MailModule,
    AuthModule,
    ContactsModule,
    TemplatesModule,
    CampaignsModule,
    SequencesModule,
    UnsubscribeModule,
    MailWebhooksModule,
    BillingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
