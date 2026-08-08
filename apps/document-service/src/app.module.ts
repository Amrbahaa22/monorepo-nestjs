import { loggerOptions } from "@monorepo/observability";
import { StorageModule } from "@monorepo/storage-kit";
import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { DocumentsModule } from "./documents/documents.module";

@Module({
  imports: [
    LoggerModule.forRoot({ pinoHttp: loggerOptions("document-service") }),
    StorageModule.forRoot(),
    DocumentsModule,
  ],
})
export class AppModule {}
