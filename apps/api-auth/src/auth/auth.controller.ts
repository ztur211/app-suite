import { All, Controller, Req, Res } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import type { Request, Response } from 'express';
import { auth } from './auth';

@Controller()
export class AuthController {
  @All('auth/*path')
  handleAuth(@Req() req: Request, @Res() res: Response): void {
    toNodeHandler(auth)(req, res);
  }
}
