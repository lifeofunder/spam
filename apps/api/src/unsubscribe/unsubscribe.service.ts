import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContactStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { SequenceLifecycleService } from '../sequences/sequence-lifecycle.service';
import { verifyUnsubscribeToken } from './unsubscribe-token.util';

@Injectable()
export class UnsubscribeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly sequenceLifecycle: SequenceLifecycleService,
  ) {}

  async processToken(tokenRaw: string) {
    const secret = this.config.get<string>('UNSUBSCRIBE_SECRET');
    if (!secret) {
      throw new BadRequestException('Unsubscribe is not configured');
    }

    const token = tokenRaw?.trim();
    if (!token) {
      throw new BadRequestException('Missing token');
    }

    const payload = verifyUnsubscribeToken(token, secret);
    if (!payload) {
      throw new BadRequestException('Invalid or expired link');
    }

    const contact = await this.prisma.contact.findFirst({
      where: { id: payload.c, workspaceId: payload.w },
    });

    if (!contact) {
      throw new BadRequestException('Invalid or expired link');
    }

    if (contact.status === ContactStatus.UNSUBSCRIBED) {
      return { ok: true as const, alreadyUnsubscribed: true as const };
    }

    await this.prisma.$transaction([
      this.prisma.contact.update({
        where: { id: contact.id },
        data: { status: ContactStatus.UNSUBSCRIBED },
      }),
      this.prisma.unsubscribeEvent.create({
        data: {
          workspaceId: contact.workspaceId,
          contactId: contact.id,
          source: 'email_link',
        },
      }),
    ]);

    await this.sequenceLifecycle.cancelEnrollmentsForContact(contact.id);

    return { ok: true as const, alreadyUnsubscribed: false as const };
  }
}
