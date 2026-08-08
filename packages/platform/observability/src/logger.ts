import { trace } from "@opentelemetry/api";
import type { Options } from "pino-http";
import { currentPaymentId } from "./payment-context";

const isProduction = process.env.NODE_ENV === "production";

export function loggerOptions(service: string): Options {
  return {
    level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
    base: { service },
    mixin: () => {
      const paymentId = currentPaymentId();
      const spanContext = trace.getActiveSpan()?.spanContext();
      return {
        ...(paymentId === undefined ? {} : { paymentId }),
        ...(spanContext === undefined
          ? {}
          : { traceId: spanContext.traceId, spanId: spanContext.spanId }),
      };
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        'req.headers["idempotency-key"]',
      ],
      remove: true,
    },
    autoLogging: {
      ignore: (req) => req.url === "/health",
    },
    serializers: {
      req: (req) => ({ method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
    transport: isProduction
      ? undefined
      : {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss.l",
            ignore: "pid,hostname,service",
            messageFormat: "\u001b[36m{service}\u001b[0m {msg}",
            singleLine: true,
          },
        },
  };
}
