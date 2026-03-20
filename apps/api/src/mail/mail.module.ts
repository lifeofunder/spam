import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevMailProvider } from './dev-mail.provider';
import { MAIL_PROVIDER } from './mail.types';
import type { MailProvider } from './mail-provider.interface';
import { SmtpMailProvider } from './smtp-mail.provider';

@Global()
@Module({
  providers: [
    SmtpMailProvider,
    {
      provide: MAIL_PROVIDER,
      useFactory: (config: ConfigService, smtp: SmtpMailProvider): MailProvider => {
        const mode = (config.get<string>('MAIL_MODE') ?? 'console').toLowerCase();
        if (mode === 'smtp') {
          return smtp;
        }
        // console, dev, empty → log-only provider
        return new DevMailProvider();
      },
      inject: [ConfigService, SmtpMailProvider],
    },
  ],
  exports: [MAIL_PROVIDER],
})
export class MailModule {}
