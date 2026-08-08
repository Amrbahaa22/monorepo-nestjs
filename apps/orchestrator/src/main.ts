import "reflect-metadata";
import { startTracing } from "@monorepo/observability";

// Must run before the modules it instruments are imported.
startTracing("orchestrator");

async function bootstrap() {
  const { NestFactory } = await import("@nestjs/core");
  const { Logger } = await import("nestjs-pino");
  const { AppModule } = await import("./app.module");

  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
}

void bootstrap();
