import { PrismaLifecycleMixin } from '../prisma-lifecycle';

describe('PrismaLifecycleMixin', () => {
  it('calls $connect on module init and $disconnect on module destroy', async () => {
    const $connect = jest.fn().mockResolvedValue(undefined);
    const $disconnect = jest.fn().mockResolvedValue(undefined);
    class FakeClient {
      $connect = $connect;
      $disconnect = $disconnect;
    }
    class Service extends PrismaLifecycleMixin(FakeClient) {}

    const svc = new Service();
    await svc.onModuleInit();
    expect($connect).toHaveBeenCalledTimes(1);
    await svc.onModuleDestroy();
    expect($disconnect).toHaveBeenCalledTimes(1);
  });

  it('preserves base-class members on the mixed class', () => {
    class FakeClient {
      $connect = jest.fn().mockResolvedValue(undefined);
      $disconnect = jest.fn().mockResolvedValue(undefined);
      ping(): string {
        return 'pong';
      }
    }
    class Service extends PrismaLifecycleMixin(FakeClient) {}
    expect(new Service().ping()).toBe('pong');
  });
});
