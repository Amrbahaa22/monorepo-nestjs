import { Global, Inject, Module, type OnModuleDestroy } from "@nestjs/common";
import { Redis } from "ioredis";

export const REDIS = Symbol("REDIS");

const redisProvider = {
  provide: REDIS,
  useFactory: () =>
    new Redis(process.env.REDIS_URL ?? "redis://localhost:6379"),
};

@Global()
@Module({ providers: [redisProvider], exports: [REDIS] })
export class InfraModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
