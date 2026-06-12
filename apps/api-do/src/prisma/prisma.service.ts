import { Injectable } from '@nestjs/common';
import { PrismaLifecycleMixin } from '@things/nest-kit';
import { PrismaClient } from '../../prisma/generated/client';

@Injectable()
export class PrismaService extends PrismaLifecycleMixin(PrismaClient) {}
