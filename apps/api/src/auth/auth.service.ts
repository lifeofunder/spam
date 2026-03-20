import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { MAIL_PROVIDER } from '../mail/mail.types';
import type { MailProvider } from '../mail/mail-provider.interface';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { TurnstileService } from './turnstile.service';
import {
  buildCompositeToken,
  generateSecretSegment,
  hashOpaqueToken,
  parseCompositeToken,
  verifyOpaqueTokenHash,
} from './token-crypto.util';

const VERIFY_TTL_MS = 48 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(MAIL_PROVIDER) private readonly mail: MailProvider,
    private readonly turnstile: TurnstileService,
  ) {}

  private getTokenPepper(): string {
    const p = this.config.get<string>('AUTH_TOKEN_PEPPER')?.trim();
    if (p) {
      return p;
    }
    return this.config.get<string>('JWT_SECRET')?.trim() ?? 'super-secret-jwt-key';
  }

  private getPublicWebUrl(): string {
    return this.config.get<string>('PUBLIC_WEB_URL')?.replace(/\/$/, '') ?? 'http://localhost:3000';
  }

  private signPayload(user: Pick<User, 'id' | 'email' | 'workspaceId' | 'emailVerifiedAt'>) {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      workspaceId: user.workspaceId,
      emailVerified: Boolean(user.emailVerifiedAt),
    });
  }

  private buildAuthResponse(user: User) {
    const accessToken = this.signPayload(user);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        workspaceId: user.workspaceId,
        emailVerified: Boolean(user.emailVerifiedAt),
      },
    };
  }

  private async sendTransactionalEmail(to: string, subject: string, text: string, html: string) {
    await this.mail.send({ to, subject, text, html });
  }

  private async setVerificationTokenAndEmail(user: User): Promise<void> {
    const pepper = this.getTokenPepper();
    const secret = generateSecretSegment();
    const token = buildCompositeToken(user.id, secret);
    const hash = hashOpaqueToken(secret, pepper);
    const expiresAt = new Date(Date.now() + VERIFY_TTL_MS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationTokenHash: hash,
        verificationTokenExpiresAt: expiresAt,
      },
    });

    const link = `${this.getPublicWebUrl()}/verify-email?token=${encodeURIComponent(token)}`;
    const subject = 'Verify your email';
    const text = `Hi ${user.name},\n\nPlease verify your email:\n${link}\n\nIf you did not sign up, ignore this message.`;
    const html = `<p>Hi ${user.name},</p><p>Please <a href="${link}">verify your email</a>.</p><p>If you did not sign up, ignore this message.</p>`;

    await this.sendTransactionalEmail(user.email, subject, text, html);
    this.logger.log(`Verification email queued/sent for user id=${user.id}`);
  }

  async register(dto: RegisterDto, remoteIp?: string) {
    await this.turnstile.verifyOptionalOrThrow(dto.turnstileToken, remoteIp);

    const emailNorm = dto.email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: emailNorm },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const workspace = await this.prisma.workspace.create({
      data: { name: `${dto.name}'s Workspace` },
    });

    const password = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: emailNorm,
        name: dto.name,
        password,
        workspaceId: workspace.id,
        emailVerifiedAt: null,
      },
    });

    try {
      await this.setVerificationTokenAndEmail(user);
    } catch (err) {
      this.logger.error(
        `Failed to send verification email for new user ${user.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const emailNorm = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: emailNorm },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        workspaceId: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      workspaceId: user.workspaceId,
      emailVerified: Boolean(user.emailVerifiedAt),
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const parsed = parseCompositeToken(dto.token);
    if (!parsed) {
      throw new BadRequestException('Invalid token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: parsed.userId },
    });

    if (
      !user?.verificationTokenHash ||
      !user.verificationTokenExpiresAt ||
      user.verificationTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired token');
    }

    const pepper = this.getTokenPepper();
    if (!verifyOpaqueTokenHash(parsed.secret, pepper, user.verificationTokenHash)) {
      throw new BadRequestException('Invalid or expired token');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        verificationTokenHash: null,
        verificationTokenExpiresAt: null,
      },
    });

    return this.buildAuthResponse(updated);
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email is already verified');
    }

    await this.setVerificationTokenAndEmail(user);
    return { ok: true as const };
  }

  async forgotPassword(dto: ForgotPasswordDto, remoteIp?: string) {
    await this.turnstile.verifyOptionalOrThrow(dto.turnstileToken, remoteIp);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      return { ok: true as const };
    }

    const pepper = this.getTokenPepper();
    const secret = generateSecretSegment();
    const token = buildCompositeToken(user.id, secret);
    const hash = hashOpaqueToken(secret, pepper);
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: hash,
        resetTokenExpiresAt: expiresAt,
      },
    });

    try {
      const link = `${this.getPublicWebUrl()}/reset-password?token=${encodeURIComponent(token)}`;
      const subject = 'Reset your password';
      const text = `Hi ${user.name},\n\nReset your password:\n${link}\n\nLink expires in 1 hour. If you did not request this, ignore this email.`;
      const html = `<p>Hi ${user.name},</p><p><a href="${link}">Reset your password</a> (expires in 1 hour).</p><p>If you did not request this, ignore this email.</p>`;
      await this.sendTransactionalEmail(user.email, subject, text, html);
      this.logger.log(`Password reset email sent for user id=${user.id}`);
    } catch (err) {
      this.logger.error(
        `Failed to send reset email for user ${user.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return { ok: true as const };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const parsed = parseCompositeToken(dto.token);
    if (!parsed) {
      throw new BadRequestException('Invalid token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: parsed.userId },
    });

    if (
      !user?.resetTokenHash ||
      !user.resetTokenExpiresAt ||
      user.resetTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired token');
    }

    const pepper = this.getTokenPepper();
    if (!verifyOpaqueTokenHash(parsed.secret, pepper, user.resetTokenHash)) {
      throw new BadRequestException('Invalid or expired token');
    }

    const password = await bcrypt.hash(dto.password, 10);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
    });

    return this.buildAuthResponse(updated);
  }
}
