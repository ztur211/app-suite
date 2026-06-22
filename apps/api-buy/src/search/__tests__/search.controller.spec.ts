import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from '../search.controller';
import { SearchService } from '../search.service';

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

describe('SearchController (unit)', () => {
  let controller: SearchController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: mockSvc }],
    }).compile();
    controller = module.get<SearchController>(SearchController);
    jest.clearAllMocks();
  });

  it('POST /items/search forwards query + limit to the service', async () => {
    mockSvc.search.mockResolvedValueOnce([{ id: 'p1' }]);

    const result = await controller.run({ query: 'milk', limit: 3 });

    expect(mockSvc.search).toHaveBeenCalledWith('milk', 3);
    expect(result).toEqual([{ id: 'p1' }]);
  });

  it('defaults a missing query to an empty string', async () => {
    mockSvc.search.mockResolvedValueOnce([]);
    await controller.run({} as { query: string });
    expect(mockSvc.search).toHaveBeenCalledWith('', undefined);
  });
});
