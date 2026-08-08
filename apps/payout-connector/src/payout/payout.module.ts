import { Module } from "@nestjs/common";
import { PayoutConsumer } from "./payout.consumer";
import { PAYOUT_RAIL } from "./rail";
import { StaticPayoutRail } from "./static-rail";

@Module({
  providers: [
    PayoutConsumer,
    { provide: PAYOUT_RAIL, useClass: StaticPayoutRail },
  ],
})
export class PayoutModule {}
