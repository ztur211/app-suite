import { NestFactory } from '@nestjs/core';
import type { INestApplication, Type } from '@nestjs/common';
import { trustedWebOrigins } from '@things/auth';

export interface BootstrapOptions {
  name: string;
  module: Type<unknown>;
  port: number;
}

/** Shared NestJS bootstrap: create the app, enable CORS for trusted web origins, listen, log. */
export async function bootstrapThingsApp(opts: BootstrapOptions): Promise<INestApplication> {
  const app = await NestFactory.create(opts.module);
  app.enableCors({ origin: trustedWebOrigins(), credentials: true });
  await app.listen(opts.port);
  console.warn(`[${opts.name}] listening on http://localhost:${opts.port}`);
  return app;
}
