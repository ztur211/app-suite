import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Expo dev servers bind 8081 upward; allow the first five for side-by-side apps.
const devWebOrigins = Array.from({ length: 5 }, (_, i) => `http://localhost:${8081 + i}`);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: devWebOrigins, credentials: true });
  const port = Number(process.env.PORT ?? 3005);
  await app.listen(port);
  console.warn(`[api-eat] listening on http://localhost:${port}`);
}

void bootstrap();
