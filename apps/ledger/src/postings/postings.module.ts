import { Module } from "@nestjs/common";
import { DrizzleLedgerRepository } from "./ledger-repository.drizzle";
import { PostingsConsumer } from "./postings.consumer";

@Module({ providers: [DrizzleLedgerRepository, PostingsConsumer] })
export class PostingsModule {}
