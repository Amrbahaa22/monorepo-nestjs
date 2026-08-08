import { KafkaModule } from "@monorepo/kafka-kit";
import { loggerOptions } from "@monorepo/observability";
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "nestjs-pino";
import { InfraModule } from "./infra.module";
import { OutboxRelayModule } from "./outbox/outbox-relay.module";
import { PaymentsModule } from "./payments/payments.module";

@Module({
  imports: [
    LoggerModule.forRoot({ pinoHttp: loggerOptions("payments-api") }),
    ScheduleModule.forRoot(),
    InfraModule,
    KafkaModule.forRoot({
      clientId: "payments-api",
    }),
    PaymentsModule,
    OutboxRelayModule,
  ],
})
export class AppModule {}
