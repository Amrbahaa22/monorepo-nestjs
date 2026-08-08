import { Module } from "@nestjs/common";
import { SagaConsumer } from "./saga.consumer";
import { SagaService } from "./saga.service";

@Module({ providers: [SagaService, SagaConsumer] })
export class SagaModule {}
