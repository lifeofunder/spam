import { IsISO8601, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  templateId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  query?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tag?: string;

  /** ISO 8601 UTC (e.g. …Z). `null` clears schedule (DRAFT only). */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsISO8601()
  scheduledAt?: string | null;
}
