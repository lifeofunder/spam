import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateTemplateDto } from './dto/create-template.dto';
import { TestSendDto } from './dto/test-send.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplatesService } from './templates.service';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Post()
  @UseGuards(EmailVerifiedGuard)
  create(@CurrentUser('workspaceId') workspaceId: string, @Body() dto: CreateTemplateDto) {
    return this.templates.create(workspaceId, dto);
  }

  @Get()
  list(@CurrentUser('workspaceId') workspaceId: string) {
    return this.templates.list(workspaceId);
  }

  @Get(':id')
  getOne(@CurrentUser('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.templates.getById(workspaceId, id);
  }

  @Post(':id/test-send')
  @UseGuards(EmailVerifiedGuard)
  testSend(
    @CurrentUser('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: TestSendDto,
  ) {
    return this.templates.testSend(workspaceId, id, dto);
  }

  @Patch(':id')
  @UseGuards(EmailVerifiedGuard)
  update(
    @CurrentUser('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templates.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @UseGuards(EmailVerifiedGuard)
  remove(@CurrentUser('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.templates.remove(workspaceId, id);
  }
}
