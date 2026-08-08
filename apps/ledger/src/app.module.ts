import { KafkaModule } from "@monorepo/kafka-kit";
import { loggerOptions } from "@monorepo/observability";
import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { InfraModule } from "./infra.module";
import { PostingsModule } from "./postings/postings.module";

@Module({
  imports: [
    LoggerModule.forRoot({ pinoHttp: loggerOptions("ledger") }),
    InfraModule,
    KafkaModule.forRoot({
      clientId: "ledger",
    }),
    PostingsModule,
  ],
})
export class AppModule {}
