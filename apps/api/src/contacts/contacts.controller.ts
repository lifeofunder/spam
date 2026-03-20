import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { getCsvImportMaxBytes } from './contacts.constants';
import { ContactsService } from './contacts.service';
import { ListContactsQueryDto } from './dto/list-contacts-query.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Post('import-csv')
  @UseGuards(EmailVerifiedGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: getCsvImportMaxBytes() },
    }),
  )
  importCsv(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required (multipart field name: file)');
    }
    return this.contacts.importCsv(workspaceId, file);
  }

  @Get()
  list(@CurrentUser('workspaceId') workspaceId: string, @Query() query: ListContactsQueryDto) {
    return this.contacts.list(workspaceId, {
      query: query.query,
      tag: query.tag,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Patch(':id')
  update(
    @CurrentUser('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contacts.update(workspaceId, id, dto);
  }

  @Post(':id/unsubscribe')
  unsubscribe(@CurrentUser('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.contacts.unsubscribe(workspaceId, id);
  }
}
