import { KafkaModule } from "@monorepo/kafka-kit";
import { loggerOptions } from "@monorepo/observability";
import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { InfraModule } from "./infra.module";
import { SagaModule } from "./saga/saga.module";

@Module({
  imports: [
    LoggerModule.forRoot({ pinoHttp: loggerOptions("orchestrator") }),
    InfraModule,
    KafkaModule.forRoot({
      clientId: "orchestrator",
    }),
    SagaModule,
  ],
})
export class AppModule {}
