import { Module } from "@nestjs/common";
import { ScreeningConsumer } from "./screening.consumer";

@Module({ providers: [ScreeningConsumer] })
export class ScreeningModule {}
