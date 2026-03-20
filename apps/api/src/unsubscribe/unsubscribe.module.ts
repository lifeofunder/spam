import { Module } from '@nestjs/common';
import { SequencesModule } from '../sequences/sequences.module';
import { UnsubscribeController } from './unsubscribe.controller';
import { UnsubscribeService } from './unsubscribe.service';

@Module({
  imports: [SequencesModule],
  controllers: [UnsubscribeController],
  providers: [UnsubscribeService],
})
export class UnsubscribeModule {}
