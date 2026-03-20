import { IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(1)
  templateId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  query?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tag?: string;

  /** Optional UTC send time; delayed BullMQ job is registered after create. */
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}
