import { DatabaseModule } from "@monorepo/db-kit";
import { Global, Inject, Module, type OnModuleDestroy } from "@nestjs/common";
import type { Redis } from "ioredis";
import * as schema from "./db/schema";
import { REDIS, redisProvider } from "./idempotency/redis.provider";

@Global()
@Module({
  imports: [
    DatabaseModule.forRoot({
      schema,
      connectionString: () =>
        process.env.PAYMENTS_API_DATABASE_URL ??
        "postgres://postgres:postgres@localhost:5432/payments_api",
    }),
  ],
  providers: [redisProvider],
  exports: [REDIS],
})
export class InfraModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
