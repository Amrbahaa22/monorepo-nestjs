import "reflect-metadata";
import { startTracing } from "@monorepo/observability";

// Must run before the modules it instruments are imported.
startTracing("document-service");

async function bootstrap() {
  const { NestFactory } = await import("@nestjs/core");
  const { Logger } = await import("nestjs-pino");
  const { S3_CLIENT, provisionBuckets } = await import("@monorepo/storage-kit");
  const { AppModule } = await import("./app.module");

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  await provisionBuckets(app.get(S3_CLIENT));
  app.enableShutdownHooks();
  await app.listen(process.env.DOCUMENT_SERVICE_PORT ?? 3002);
}

void bootstrap();
