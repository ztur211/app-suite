import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController (api-auth)', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    controller = moduleRef.get(HealthController);
  });

  it('returns { status: "ok", service: "api-auth" } from /health', () => {
    expect(controller.check()).toEqual({ status: 'ok', service: 'api-auth' });
  });
});
