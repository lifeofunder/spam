import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TurnstileService } from './turnstile.service';
import { EmailVerifiedGuard } from './guards/email-verified.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60_000,
          limit: 120,
        },
      ],
    }),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'super-secret-jwt-key',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, TurnstileService, EmailVerifiedGuard],
  exports: [AuthService, JwtModule, PassportModule, JwtStrategy, EmailVerifiedGuard],
})
export class AuthModule {}
