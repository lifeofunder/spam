import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../src/prisma.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { SequenceJobSchedulerService } from '../src/sequences/sequence-job-scheduler.service';
import { SequencesController } from '../src/sequences/sequences.controller';
import { SequencesService } from '../src/sequences/sequences.service';
import { SequenceLifecycleService } from '../src/sequences/sequence-lifecycle.service';
import { EntitlementsService } from '../src/billing/entitlements.service';
import { EmailVerifiedGuard } from '../src/auth/guards/email-verified.guard';
import request from 'supertest';

const workspaceGuard: CanActivate = {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = { workspaceId: 'ws1', sub: 'user1' };
    return true;
  },
};

describe('SequencesController enroll (integration)', () => {
  let app: INestApplication;

  const schedulerMock = {
    scheduleStepSend: jest.fn().mockResolvedValue('job-1'),
    removeAllKnownJobsForEnrollment: jest.fn(),
    removeJobById: jest.fn(),
  };

  const entitlementsMock = {
    assertMarketingAllowed: jest.fn().mockResolvedValue(undefined),
    assertCanActivateSequence: jest.fn().mockResolvedValue(undefined),
    assertCanCreateContacts: jest.fn().mockResolvedValue(undefined),
    assertCanSendEmail: jest.fn().mockResolvedValue(undefined),
    assertCanSendEmails: jest.fn().mockResolvedValue(undefined),
    assertNotPastDue: jest.fn().mockResolvedValue(undefined),
    getLimits: jest.fn(),
  };

  const prismaMock = {
    sequence: {
      findFirst: jest.fn(),
    },
    contact: {
      findMany: jest.fn(),
    },
    sequenceEnrollment: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'enr1' }),
      update: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET: 'x' })],
        }),
      ],
      controllers: [SequencesController],
      providers: [
        SequencesService,
        SequenceLifecycleService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SequenceJobSchedulerService, useValue: schedulerMock },
        { provide: EntitlementsService, useValue: entitlementsMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(workspaceGuard)
      .overrideGuard(EmailVerifiedGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.sequence.findFirst.mockResolvedValue({
      id: 'seq1',
      workspaceId: 'ws1',
      status: 'ACTIVE',
      steps: [{ order: 1, delayMinutes: 0, templateId: 't1' }],
    });
    prismaMock.contact.findMany.mockResolvedValue([{ id: 'c1' }]);
  });

  it('POST /sequences/:id/enroll calls scheduleStepSend', async () => {
    const res = await request(app.getHttpServer())
      .post('/sequences/seq1/enroll')
      .send({ contactIds: ['c1'] })
      .expect(201);

    expect(res.body.enrolled).toBe(1);
    expect(schedulerMock.scheduleStepSend).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollmentId: 'enr1',
        workspaceId: 'ws1',
        stepOrder: 1,
      }),
      0,
    );
  });
});
