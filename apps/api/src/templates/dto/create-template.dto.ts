import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500_000)
  html!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  text?: string;
}
