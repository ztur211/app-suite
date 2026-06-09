import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { trustedWebOrigins } from '@things/auth';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: trustedWebOrigins(), credentials: true });
  const port = Number(process.env.PORT ?? 3005);
  await app.listen(port);
  console.warn(`[api-eat] listening on http://localhost:${port}`);
}

void bootstrap();
