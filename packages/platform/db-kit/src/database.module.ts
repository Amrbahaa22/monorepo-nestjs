import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  type OnModuleDestroy,
} from "@nestjs/common";
import { createDatabase, DATABASE, type Database } from "./client";

export interface DatabaseModuleOptions<
  TSchema extends Record<string, unknown>,
> {
  readonly schema: TSchema;
  /**
   * Read at DI time, never in a decorator argument — a value computed there is
   * frozen at import time, before env is loaded.
   */
  readonly connectionString: () => string;
  readonly maxConnections?: number;
}

@Global()
@Module({})
export class DatabaseModule implements OnModuleDestroy {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database<Record<string, unknown>>,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.db.$client.end({ timeout: 5 });
  }

  static forRoot<TSchema extends Record<string, unknown>>(
    options: DatabaseModuleOptions<TSchema>,
  ): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: DATABASE,
          useFactory: () =>
            createDatabase(options.schema, {
              connectionString: options.connectionString(),
              maxConnections: options.maxConnections,
            }),
        },
      ],
      exports: [DATABASE],
    };
  }
}
