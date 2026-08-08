import "reflect-metadata";
import { createServer } from "node:http";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { PostingCompletedEventV1, TOPICS } from "@monorepo/contracts";
import { runMigrations } from "@monorepo/db-kit";
import { ladderTopicNames } from "@monorepo/kafka-kit";
import type { INestApplication, INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  KafkaContainer,
  type StartedKafkaContainer,
} from "@testcontainers/kafka";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import {
  RedisContainer,
  type StartedRedisContainer,
} from "@testcontainers/redis";
import { type Consumer, Kafka } from "kafkajs";
import postgres from "postgres";
import { AppModule as LedgerAppModule } from "../../../apps/ledger/src/app.module";
import { AppModule as OrchestratorAppModule } from "../../../apps/orchestrator/src/app.module";
import { AppModule as PaymentsAppModule } from "../../../apps/payments-api/src/app.module";

const root = join(__dirname, "../../..");

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("failed to allocate port"));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitUntil<T>(
  probe: () => Promise<T | null | undefined | false>,
  label: string,
  timeoutMs = 90_000,
): Promise<T> {
  const started = Date.now();
  let lastError: unknown;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await probe();
      if (value) {
        return value;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `timed out waiting for ${label}: ${
      lastError instanceof Error ? lastError.message : String(lastError ?? "")
    }`,
  );
}

function dbUrl(base: string, database: string): string {
  const url = new URL(base);
  url.pathname = `/${database}`;
  return url.toString();
}

async function applyMigrations(
  connectionString: string,
  relativeDirectory: string,
): Promise<void> {
  const sql = postgres(connectionString, { max: 1 });
  try {
    await runMigrations(sql, join(root, relativeDirectory));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

describe("payment reserve flow", () => {
  let postgresContainer: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let kafkaContainer: StartedKafkaContainer;
  let paymentsApp: INestApplication;
  let orchestratorApp: INestApplicationContext;
  let ledgerApp: INestApplicationContext;
  let paymentsBaseUrl: string;
  let ledgerDbUrl: string;
  let kafkaBrokers: string;
  let ledgerEventCollector: Consumer;
  const ledgerEvents: unknown[] = [];

  beforeAll(async () => {
    postgresContainer = await new PostgreSqlContainer(
      "postgres:16-alpine",
    ).start();
    redisContainer = await new RedisContainer("redis:7-alpine").start();
    kafkaContainer = await new KafkaContainer("confluentinc/cp-kafka:7.6.1")
      .withKraft()
      .start();

    const adminUrl = postgresContainer.getConnectionUri();
    const admin = postgres(adminUrl, { max: 1 });
    try {
      await admin.unsafe("CREATE DATABASE payments_api");
      await admin.unsafe("CREATE DATABASE orchestrator");
      await admin.unsafe("CREATE DATABASE ledger");
    } finally {
      await admin.end({ timeout: 5 });
    }

    const paymentsDb = dbUrl(adminUrl, "payments_api");
    const orchestratorDb = dbUrl(adminUrl, "orchestrator");
    ledgerDbUrl = dbUrl(adminUrl, "ledger");

    // Same runner production uses, so the test cannot drift from real migrations.
    await applyMigrations(paymentsDb, "apps/payments-api/src/db/migrations");
    await applyMigrations(
      orchestratorDb,
      "apps/orchestrator/src/db/migrations",
    );
    await applyMigrations(ledgerDbUrl, "apps/ledger/src/db/migrations");

    kafkaBrokers = `${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(9093)}`;
    const kafka = new Kafka({ clientId: "e2e-admin", brokers: [kafkaBrokers] });
    const adminKafka = kafka.admin();
    await adminKafka.connect();
    // Retry tiers and dlq must exist too: consumers subscribe to them at boot.
    const topics = [
      ...ladderTopicNames(TOPICS.paymentEventsV1),
      ...ladderTopicNames(TOPICS.ledgerCommandsV1),
      ...ladderTopicNames(TOPICS.ledgerEventsV1),
      ...ladderTopicNames(TOPICS.riskCommandsV1),
      ...ladderTopicNames(TOPICS.riskEventsV1),
      ...ladderTopicNames(TOPICS.payoutCommandsV1),
      ...ladderTopicNames(TOPICS.payoutEventsV1),
      TOPICS.payoutReconcileV1,
    ];
    await adminKafka.createTopics({
      topics: topics.map((topic) => ({ topic, numPartitions: 1 })),
    });
    await adminKafka.disconnect();

    // Subscribe before the apps start so the assertion cannot race the producer.
    ledgerEventCollector = kafka.consumer({
      groupId: `e2e-collector-${Date.now()}`,
    });
    await ledgerEventCollector.connect();
    await ledgerEventCollector.subscribe({
      topic: TOPICS.ledgerEventsV1,
      fromBeginning: true,
    });
    await ledgerEventCollector.run({
      eachMessage: async ({ message }) => {
        if (message.value) {
          ledgerEvents.push(JSON.parse(message.value.toString()));
        }
      },
    });

    const port = await freePort();
    process.env.PAYMENTS_API_DATABASE_URL = paymentsDb;
    process.env.ORCHESTRATOR_DATABASE_URL = orchestratorDb;
    process.env.LEDGER_DATABASE_URL = ledgerDbUrl;
    process.env.REDIS_URL = redisContainer.getConnectionUrl();
    process.env.KAFKA_BROKERS = kafkaBrokers;
    process.env.PORT = String(port);
    process.env.KAFKAJS_NO_PARTITIONER_WARNING = "1";

    paymentsApp = await NestFactory.create(PaymentsAppModule, {
      logger: false,
    });
    await paymentsApp.listen(port);
    paymentsBaseUrl = `http://127.0.0.1:${port}`;

    orchestratorApp = await NestFactory.createApplicationContext(
      OrchestratorAppModule,
      { logger: false },
    );
    ledgerApp = await NestFactory.createApplicationContext(LedgerAppModule, {
      logger: false,
    });
  }, 180_000);

  afterAll(async () => {
    await ledgerEventCollector?.disconnect();
    await paymentsApp?.close();
    await orchestratorApp?.close();
    await ledgerApp?.close();
    await Promise.all([
      postgresContainer?.stop(),
      redisContainer?.stop(),
      kafkaContainer?.stop(),
    ]);
  });

  it("reserves a balanced posting batch and emits PostingCompleted", async () => {
    const response = await fetch(`${paymentsBaseUrl}/payments`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "e2e-reserve-1",
      },
      body: JSON.stringify({
        sourceAccountId: "acct_a",
        destinationAccountId: "acct_b",
        amountMinorUnits: "5000",
        currency: "USD",
      }),
    });

    expect(response.status).toBe(202);
    const body = (await response.json()) as {
      paymentId: string;
      duplicate: boolean;
    };
    expect(body.duplicate).toBe(false);
    expect(body.paymentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const rows = await waitUntil(async () => {
      const sql = postgres(ledgerDbUrl, { max: 1 });
      try {
        const found = await sql<
          {
            payment_id: string;
            phase: string;
            account_id: string;
            direction: string;
            amount_minor_units: string;
            currency: string;
          }[]
        >`
          SELECT b.payment_id, b.phase, e.account_id, e.direction,
                 e.amount_minor_units, e.currency
            FROM posting_batches b
            JOIN journal_entries e ON e.batch_id = b.id
           WHERE b.payment_id = ${body.paymentId}::uuid
           ORDER BY e.direction DESC
        `;
        return found.length === 2 ? found : null;
      } finally {
        await sql.end({ timeout: 5 });
      }
    }, "balanced journal_entries");

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          payment_id: body.paymentId,
          phase: "reserve",
          account_id: "acct_a",
          direction: "debit",
          // postgres.js returns int8 as a string; never a JS number, which would lose precision
          amount_minor_units: "5000",
          currency: "USD",
        }),
        expect.objectContaining({
          payment_id: body.paymentId,
          phase: "reserve",
          account_id: "reserve:clearing:USD",
          direction: "credit",
          amount_minor_units: "5000",
          currency: "USD",
        }),
      ]),
    );

    const raw = await waitUntil(
      async () =>
        ledgerEvents.find(
          (event) =>
            (event as { paymentId?: string }).paymentId === body.paymentId,
        ) ?? null,
      "PostingCompleted on ledger.events.v1",
      30_000,
    );

    const reserved = PostingCompletedEventV1.parse(raw);

    expect(reserved.type).toBe("PostingCompleted");
    expect(reserved.payload.phase).toBe("reserve");
    expect(reserved.payload.batchId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
