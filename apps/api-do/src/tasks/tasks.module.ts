import { Module } from '@nestjs/common';
import { PrismaClient } from '../../prisma/generated/client';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [TasksController],
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => new PrismaClient(),
    },
    TasksService,
  ],
})
export class TasksModule {}
