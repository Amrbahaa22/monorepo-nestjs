import { loggerOptions } from "@monorepo/observability";
import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { InfraModule } from "./infra.module";
import { QuotesModule } from "./quotes/quotes.module";

@Module({
  imports: [
    LoggerModule.forRoot({ pinoHttp: loggerOptions("fx-quote") }),
    InfraModule,
    QuotesModule,
  ],
})
export class AppModule {}
