import { DatabaseModule } from "@monorepo/db-kit";
import { Module } from "@nestjs/common";
import * as schema from "./db/schema";

@Module({
  imports: [
    DatabaseModule.forRoot({
      schema,
      connectionString: () =>
        process.env.LEDGER_DATABASE_URL ??
        "postgres://postgres:postgres@localhost:5432/ledger",
    }),
  ],
})
export class InfraModule {}
