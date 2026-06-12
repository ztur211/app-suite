import 'dotenv/config';
import 'reflect-metadata';
import { bootstrapThingsApp } from '@things/nest-kit';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

void bootstrapThingsApp({ name: 'api-say', module: AppModule, port: loadEnv().PORT });
