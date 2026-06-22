import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryController } from '../discovery.controller';
import { DiscoveryService } from '../discovery.service';

const mockSvc = { search: jest.fn() };

jest.mock('../../auth/session.guard', () => ({
  SessionGuard: class {
    canActivate() {
      return true;
    }
  },
}));

jest.mock('../../auth/auth', () => ({
  auth: { api: { getSession: jest.fn() } },
}));

describe('DiscoveryController (unit)', () => {
  let controller: DiscoveryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiscoveryController],
      providers: [{ provide: DiscoveryService, useValue: mockSvc }],
    }).compile();
    controller = module.get<DiscoveryController>(DiscoveryController);
    jest.clearAllMocks();
  });

  it('POST /meals/search forwards query, kind, location and limit', async () => {
    mockSvc.search.mockResolvedValueOnce({ kind: 'restaurant', results: [] });

    await controller.run({ query: 'sushi', kind: 'restaurant', location: 'NYC', limit: 5 });

    expect(mockSvc.search).toHaveBeenCalledWith('sushi', 'restaurant', {
      limit: 5,
      location: 'NYC',
    });
  });

  it('defaults kind to recipe when omitted', async () => {
    mockSvc.search.mockResolvedValueOnce({ kind: 'recipe', results: [] });

    await controller.run({ query: 'pasta' });

    expect(mockSvc.search).toHaveBeenCalledWith('pasta', 'recipe', {
      limit: undefined,
      location: undefined,
    });
  });
});
