import { DatabaseModule } from "@monorepo/db-kit";
import { Module } from "@nestjs/common";
import * as schema from "./db/schema";

@Module({
  imports: [
    DatabaseModule.forRoot({
      schema,
      connectionString: () =>
        process.env.ORCHESTRATOR_DATABASE_URL ??
        "postgres://postgres:postgres@localhost:5432/orchestrator",
    }),
  ],
})
export class InfraModule {}
