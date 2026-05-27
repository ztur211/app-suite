import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import type { Intent } from '@things/types';
import { SessionGuard } from '../auth/session.guard';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor';
import { DictationsService } from './dictations.service';
import type { CreateDictationDto } from './dto/create-dictation.dto';
import type { ReclassifyDto } from './dto/reclassify.dto';

interface MulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

function requireSession(req: Request) {
  if (!req.session) {
    throw new Error('SessionGuard did not attach session');
  }
  return req.session;
}

@Controller('dictations')
@UseGuards(SessionGuard)
export class DictationsController {
  constructor(private readonly svc: DictationsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('audio'), IdempotencyInterceptor)
  async create(
    @Req() req: Request,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: CreateDictationDto,
    @UploadedFile() audio?: MulterFile,
  ) {
    const session = requireSession(req);
    return this.svc.create({
      idempotencyKey,
      userId: session.user.id,
      userTimezone: session.user.timezone,
      previewTranscript: body.previewTranscript,
      captureMode: body.captureMode,
      audioBuffer: audio?.buffer,
    });
  }

  @Get()
  async list(
    @Req() req: Request,
    @Query('intent') intent?: Intent,
    @Query('limit') limit?: string,
  ) {
    const session = requireSession(req);
    return this.svc.list(session.user.id, {
      intent,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Patch(':id')
  @UseInterceptors(IdempotencyInterceptor)
  async edit(@Req() req: Request, @Param('id') id: string, @Body() editedPayload: unknown) {
    const session = requireSession(req);
    return this.svc.patchEdit(id, session.user.id, editedPayload);
  }

  @Post(':id/dispatch')
  @UseInterceptors(IdempotencyInterceptor)
  async dispatch(@Req() req: Request, @Param('id') id: string) {
    const session = requireSession(req);
    return this.svc.dispatch(id, session.user.id);
  }

  @Delete(':id/dispatch')
  @UseInterceptors(IdempotencyInterceptor)
  async undoDispatch(@Req() req: Request, @Param('id') id: string) {
    const session = requireSession(req);
    return this.svc.undoDispatch(id, session.user.id);
  }

  @Post(':id/reclassify')
  @UseInterceptors(IdempotencyInterceptor)
  async reclassify(@Req() req: Request, @Param('id') id: string, @Body() body: ReclassifyDto) {
    const session = requireSession(req);
    return this.svc.reclassify(id, session.user.id, body.forceIntent, session.user.timezone);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const session = requireSession(req);
    await this.svc.remove(id, session.user.id);
    return { ok: true };
  }
}
