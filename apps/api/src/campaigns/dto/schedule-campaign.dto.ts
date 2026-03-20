import { IsISO8601, IsOptional } from 'class-validator';

export class ScheduleCampaignDto {
  /** If set, updates `scheduledAt` before enqueueing the delayed job (DRAFT only). */
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}
