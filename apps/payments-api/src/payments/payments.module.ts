import { Module } from "@nestjs/common";
import { IdempotencyService } from "../idempotency/idempotency.service";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, IdempotencyService],
})
export class PaymentsModule {}
