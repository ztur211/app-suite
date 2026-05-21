import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3003);
  await app.listen(port);
  console.warn(`[api-say] listening on http://localhost:${port}`);
}

void bootstrap();
