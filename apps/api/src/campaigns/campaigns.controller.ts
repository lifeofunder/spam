import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ScheduleCampaignDto } from './dto/schedule-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CampaignsService } from './campaigns.service';

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Post()
  @UseGuards(EmailVerifiedGuard)
  create(@CurrentUser('workspaceId') workspaceId: string, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(workspaceId, dto);
  }

  @Get()
  list(@CurrentUser('workspaceId') workspaceId: string) {
    return this.campaigns.list(workspaceId);
  }

  @Patch(':id')
  update(
    @CurrentUser('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaigns.update(workspaceId, id, dto);
  }

  @Post(':id/schedule')
  @UseGuards(EmailVerifiedGuard)
  schedule(
    @CurrentUser('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: ScheduleCampaignDto,
  ) {
    return this.campaigns.schedule(workspaceId, id, dto);
  }

  @Post(':id/cancel-schedule')
  @UseGuards(EmailVerifiedGuard)
  cancelSchedule(@CurrentUser('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.campaigns.cancelSchedule(workspaceId, id);
  }

  @Get(':id/send-status')
  getSendStatus(@CurrentUser('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.campaigns.getSendStatus(workspaceId, id);
  }

  @Get(':id')
  getOne(@CurrentUser('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.campaigns.getById(workspaceId, id);
  }

  @Post(':id/send-now')
  @UseGuards(EmailVerifiedGuard)
  sendNow(@CurrentUser('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.campaigns.sendNow(workspaceId, id);
  }
}
