import { KafkaModule } from "@monorepo/kafka-kit";
import { loggerOptions } from "@monorepo/observability";
import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { ScreeningModule } from "./screening/screening.module";

@Module({
  imports: [
    LoggerModule.forRoot({ pinoHttp: loggerOptions("risk-screening") }),
    KafkaModule.forRoot({ clientId: "risk-screening" }),
    ScreeningModule,
  ],
})
export class AppModule {}
