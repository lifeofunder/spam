import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;

  /** Cloudflare Turnstile token (required when `TURNSTILE_SECRET_KEY` is set). */
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
