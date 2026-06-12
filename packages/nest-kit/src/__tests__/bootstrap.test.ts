import { NestFactory } from '@nestjs/core';
import { bootstrapThingsApp } from '../bootstrap';

jest.mock('@nestjs/core', () => ({ NestFactory: { create: jest.fn() } }));
jest.mock('@things/auth', () => ({ trustedWebOrigins: () => ['http://web.test'] }));

describe('bootstrapThingsApp', () => {
  it('creates the app, enables CORS with trusted origins, listens, and returns the app', async () => {
    const enableCors = jest.fn();
    const listen = jest.fn().mockResolvedValue(undefined);
    const fakeApp = { enableCors, listen };
    (NestFactory.create as jest.Mock).mockResolvedValueOnce(fakeApp);
    class AppModule {}

    const app = await bootstrapThingsApp({ name: 'api-x', module: AppModule, port: 4321 });

    expect(NestFactory.create).toHaveBeenCalledWith(AppModule);
    expect(enableCors).toHaveBeenCalledWith({ origin: ['http://web.test'], credentials: true });
    expect(listen).toHaveBeenCalledWith(4321);
    expect(app).toBe(fakeApp);
  });
});
