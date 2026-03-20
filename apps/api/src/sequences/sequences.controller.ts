import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateSequenceDto } from './dto/create-sequence.dto';
import { EnrollSequenceDto } from './dto/enroll-sequence.dto';
import { UpdateSequenceDto } from './dto/update-sequence.dto';
import { SequencesService } from './sequences.service';

@Controller('sequences')
@UseGuards(JwtAuthGuard)
export class SequencesController {
  constructor(private readonly sequences: SequencesService) {}

  @Post()
  @UseGuards(EmailVerifiedGuard)
  create(@CurrentUser('workspaceId') workspaceId: string, @Body() dto: CreateSequenceDto) {
    return this.sequences.create(workspaceId, dto);
  }

  @Get()
  list(@CurrentUser('workspaceId') workspaceId: string) {
    return this.sequences.list(workspaceId);
  }

  @Get(':id/enrollments')
  listEnrollments(
    @CurrentUser('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.sequences.listEnrollments(workspaceId, id, page, pageSize);
  }

  @Get(':id')
  getOne(@CurrentUser('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.sequences.getById(workspaceId, id);
  }

  @Patch(':id')
  @UseGuards(EmailVerifiedGuard)
  update(
    @CurrentUser('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSequenceDto,
  ) {
    return this.sequences.update(workspaceId, id, dto);
  }

  @Post(':id/activate')
  @UseGuards(EmailVerifiedGuard)
  activate(@CurrentUser('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.sequences.activate(workspaceId, id);
  }

  @Post(':id/archive')
  @UseGuards(EmailVerifiedGuard)
  archive(@CurrentUser('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.sequences.archive(workspaceId, id);
  }

  @Post(':id/enroll')
  @UseGuards(EmailVerifiedGuard)
  enroll(
    @CurrentUser('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: EnrollSequenceDto,
  ) {
    return this.sequences.enroll(workspaceId, id, dto);
  }
}
