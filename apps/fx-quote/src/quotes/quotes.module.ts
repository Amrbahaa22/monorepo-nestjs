import { Module } from "@nestjs/common";
import { QuotesController } from "./quotes.controller";
import { QuotesService } from "./quotes.service";
import { RATE_SOURCE, StaticRateSource } from "./rate-source";

@Module({
  controllers: [QuotesController],
  providers: [
    QuotesService,
    { provide: RATE_SOURCE, useClass: StaticRateSource },
  ],
})
export class QuotesModule {}
