import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

/** The connection-lifecycle surface every generated PrismaClient exposes. */
export interface PrismaLifecycleClient {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
}

// A mixin base must use an `any[]` rest constructor (TS requirement for `extends`).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctor<T> = new (...args: any[]) => T;

/**
 * Mixes Nest's connect-on-init / disconnect-on-destroy lifecycle into a
 * generated PrismaClient subclass:
 *   @Injectable()
 *   export class PrismaService extends PrismaLifecycleMixin(PrismaClient) {}
 */
export function PrismaLifecycleMixin<TBase extends Ctor<PrismaLifecycleClient>>(Base: TBase) {
  class PrismaLifecycle extends Base implements OnModuleInit, OnModuleDestroy {
    async onModuleInit(): Promise<void> {
      await this.$connect();
    }
    async onModuleDestroy(): Promise<void> {
      await this.$disconnect();
    }
  }
  return PrismaLifecycle;
}
