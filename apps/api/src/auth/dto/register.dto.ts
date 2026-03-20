import { Equals, IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsBoolean()
  @Equals(true, { message: 'You must accept the Terms and Privacy Policy' })
  acceptTerms!: boolean;

  /** Cloudflare Turnstile token (required when `TURNSTILE_SECRET_KEY` is set). */
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
