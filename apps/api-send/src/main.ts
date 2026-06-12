import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { trustedWebOrigins } from '@things/auth';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: trustedWebOrigins(), credentials: true });
  await app.listen(env.PORT);
  console.warn(`[api-send] listening on http://localhost:${env.PORT}`);
}

void bootstrap();
