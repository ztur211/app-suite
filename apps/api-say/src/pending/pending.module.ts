import { Module } from '@nestjs/common';
import { PendingController } from './pending.controller';
import { PendingService } from './pending.service';

@Module({
  controllers: [PendingController],
  providers: [PendingService],
})
export class PendingModule {}
