import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { TurnstileService } from '../src/auth/turnstile.service';
import { MAIL_PROVIDER } from '../src/mail/mail.types';
import { PrismaService } from '../src/prisma.service';

const allowThrottler: CanActivate = { canActivate: () => true };

describe('AuthController (integration)', () => {
  let app: INestApplication;

  const mailMock = {
    send: jest.fn().mockResolvedValue(undefined),
  };

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-for-auth-tests';

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_SECRET: 'test-jwt-secret-for-auth-tests',
              AUTH_TOKEN_PEPPER: 'test-pepper-auth',
              PUBLIC_WEB_URL: 'http://localhost:3000',
            }),
          ],
        }),
        JwtModule.register({
          secret: 'test-jwt-secret-for-auth-tests',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        TurnstileService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MAIL_PROVIDER, useValue: mailMock },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue(allowThrottler)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /auth/forgot-password returns 200 when user is missing (no email leak)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mailMock.send).not.toHaveBeenCalled();
  });

  it('POST /auth/forgot-password returns 200 and sends mail when user exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user_reset_1',
      email: 'a@example.com',
      name: 'A',
    });
    prismaMock.user.update.mockResolvedValue({});

    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'a@example.com' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(prismaMock.user.update).toHaveBeenCalled();
    expect(mailMock.send).toHaveBeenCalled();
    const call = mailMock.send.mock.calls[0][0];
    expect(call.html).toContain('/reset-password?token=');
  });

  it('POST /auth/verify-email happy path returns new tokens', async () => {
    const { buildCompositeToken, generateSecretSegment, hashOpaqueToken } = await import(
      '../src/auth/token-crypto.util'
    );
    const userId = 'user_verify_1';
    const secret = generateSecretSegment(16);
    const token = buildCompositeToken(userId, secret);
    const hash = hashOpaqueToken(secret, 'test-pepper-auth');

    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'v@example.com',
      name: 'V',
      password: 'x',
      workspaceId: 'ws1',
      emailVerifiedAt: null,
      verificationTokenHash: hash,
      verificationTokenExpiresAt: new Date(Date.now() + 60_000),
    });

    prismaMock.user.update.mockResolvedValue({
      id: userId,
      email: 'v@example.com',
      name: 'V',
      password: 'x',
      workspaceId: 'ws1',
      emailVerifiedAt: new Date(),
      verificationTokenHash: null,
      verificationTokenExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    });

    const res = await request(app.getHttpServer()).post('/auth/verify-email').send({ token });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.emailVerified).toBe(true);
  });
});
