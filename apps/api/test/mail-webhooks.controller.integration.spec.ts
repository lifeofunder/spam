import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../src/prisma.service';
import { SequenceLifecycleService } from '../src/sequences/sequence-lifecycle.service';
import { MailWebhooksController } from '../src/webhooks/mail/mail-webhooks.controller';
import { MailWebhooksService } from '../src/webhooks/mail/mail-webhooks.service';
import { WebhookMailSecretGuard } from '../src/webhooks/mail/guards/webhook-mail-secret.guard';
import { WebhookThrottleGuard } from '../src/webhooks/mail/guards/webhook-throttle.guard';
import request from 'supertest';

describe('MailWebhooksController (integration)', () => {
  let app: INestApplication;
  const prismaMock = {
    webhookEvent: {
      create: jest.fn().mockResolvedValue({ id: 'w1' }),
    },
    messageEvent: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    contact: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const sequenceLifecycleMock = {
    cancelEnrollmentsForContact: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              WEBHOOK_MAIL_SECRET: 'test-webhook-secret',
              WEBHOOK_MAIL_MAX_PER_MINUTE_IP: '10000',
            }),
          ],
        }),
      ],
      controllers: [MailWebhooksController],
      providers: [
        MailWebhooksService,
        WebhookMailSecretGuard,
        WebhookThrottleGuard,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SequenceLifecycleService, useValue: sequenceLifecycleMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.webhookEvent.create.mockResolvedValue({ id: 'w1' });
    prismaMock.messageEvent.findFirst.mockResolvedValue(null);
  });

  it('POST /webhooks/mail/generic accepts valid secret and payload', async () => {
    await request(app.getHttpServer())
      .post('/webhooks/mail/generic')
      .set('X-Webhook-Secret', 'test-webhook-secret')
      .send({ type: 'delivered', email: 'a@b.co' })
      .expect(201);

    expect(prismaMock.webhookEvent.create).toHaveBeenCalledTimes(1);
  });

  it('POST /webhooks/mail/generic rejects wrong secret', async () => {
    await request(app.getHttpServer())
      .post('/webhooks/mail/generic')
      .set('X-Webhook-Secret', 'wrong')
      .send({ type: 'delivered', email: 'a@b.co' })
      .expect(401);
    expect(prismaMock.webhookEvent.create).not.toHaveBeenCalled();
  });

  it('POST /webhooks/mail/generic rejects invalid body', async () => {
    await request(app.getHttpServer())
      .post('/webhooks/mail/generic')
      .set('X-Webhook-Secret', 'test-webhook-secret')
      .send({ type: 'delivered', email: 'not-an-email' })
      .expect(400);
  });
});
