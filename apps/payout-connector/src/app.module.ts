import { KafkaModule } from "@monorepo/kafka-kit";
import { loggerOptions } from "@monorepo/observability";
import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { PayoutModule } from "./payout/payout.module";

@Module({
  imports: [
    LoggerModule.forRoot({ pinoHttp: loggerOptions("payout-connector") }),
    KafkaModule.forRoot({ clientId: "payout-connector" }),
    PayoutModule,
  ],
})
export class AppModule {}
