import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller';

// Stub the Better Auth handler so the unit test doesn't touch a real DB.
jest.mock('../auth', () => ({
  auth: {
    handler: jest.fn(),
  },
}));

describe('AuthController (unit)', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
    }).compile();
    controller = module.get<AuthController>(AuthController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('has a handleAuth method', () => {
    expect(typeof controller.handleAuth).toBe('function');
  });
});
