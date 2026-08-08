import "reflect-metadata";
import { startTracing } from "@monorepo/observability";

// Must run before the modules it instruments are imported.
startTracing("fx-quote");

async function bootstrap() {
  const { NestFactory } = await import("@nestjs/core");
  const { Logger } = await import("nestjs-pino");
  const { AppModule } = await import("./app.module");

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  await app.listen(process.env.FX_QUOTE_PORT ?? 3001);
}

void bootstrap();
