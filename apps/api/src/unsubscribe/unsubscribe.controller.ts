import { Controller, Get, Query } from '@nestjs/common';
import { UnsubscribeService } from './unsubscribe.service';
import { UnsubscribeQueryDto } from './dto/unsubscribe-query.dto';

@Controller('unsubscribe')
export class UnsubscribeController {
  constructor(private readonly unsubscribeService: UnsubscribeService) {}

  @Get()
  async handle(@Query() query: UnsubscribeQueryDto) {
    return this.unsubscribeService.processToken(query.token);
  }
}
