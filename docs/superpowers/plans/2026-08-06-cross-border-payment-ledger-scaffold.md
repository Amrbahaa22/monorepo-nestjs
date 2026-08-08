# Cross-Border Payment Ledger Scaffold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a Turborepo/pnpm monorepo for a cross-border payment ledger with strict inward-only dependency layering, and make one path work end-to-end: `POST /payments` → outbox relay → `payment.events.v1` → orchestrator → `ledger.commands.v1` → balanced reserve postings → `ledger.events.v1`.

**Architecture:** Hexagonal/ports-and-adapters. `packages/domain` defines pure models, money arithmetic, ledger invariants, and four port interfaces (`EventPublisher`, `LedgerRepository`, `QuoteProvider`, `ObjectStore`). `packages/contracts` defines the Zod wire schemas for Kafka messages. `packages/platform/*` are adapters implementing ports. `apps/*` are NestJS composition roots that wire adapters to ports and hold HTTP/consumer entrypoints only. Dependency direction is enforced mechanically by dependency-cruiser, not by convention.

**Tech Stack:** TypeScript, NestJS, KafkaJS, PostgreSQL + Drizzle ORM, ioredis, MinIO (`@aws-sdk/client-s3`), Turborepo + Bun workspaces (package manager only — Node runs the apps), Zod, Jest (ts-jest) for tests, Biome for lint/format, Lefthook for git hooks, Pino, OpenTelemetry, dependency-cruiser, testcontainers (integration test only).

**Tooling note (superseded from original spec):** Vitest → Jest, pnpm → Bun (package-manager role only), ESLint → Biome, Lefthook added for git hooks. Confirmed with user on 2026-08-06. dependency-cruiser is unaffected — Biome has no folder-to-folder architecture rule, so it stays as the layering gate.

## Global Constraints

- No substituting the fixed stack. No new dependency without asking first.
- `packages/domain` imports nothing but TypeScript stdlib — no `kafkajs`, `drizzle-orm`, `ioredis`, `@nestjs/*`. Unit-testable with zero infra.
- `packages/contracts` imports only `zod`. Every schema carries a `version` literal discriminator.
- No shared `db` package. Each app owns its Drizzle schema/migrations under `apps/<app>/src/db`. Services never read another service's tables.
- Amounts: `bigint` minor units + ISO-4217 currency, always paired. Never `numeric`, never floating point, never a bare number.
- Journal tables: insert-only. No `UPDATE`, no `DELETE`, no soft-delete column. Reversals are compensating entries (future phase — not built now).
- Kafka: topics named `<domain>.commands.v1` / `<domain>.events.v1`, never mixed. Every message keyed by `payment_id`. Consumer offsets commit only after the handler's DB transaction commits.
- Small files, one responsibility each. No commented-out code, no `TODO` stubs in the shipped path, no `try/catch` that swallows errors.
- Every domain invariant gets a unit test needing no running infra. One integration test (testcontainers) covers the full e2e path.
- After each phase below: run `pnpm lint && pnpm test`, show output, wait before moving to the next phase.

## Decisions Locked In (confirmed with user before writing this plan)

1. **Outbox relay** lives inside `payments-api` as an in-process scheduled poller — not a separate app.
2. **Retry topology** (`.retry.5s`/`.retry.1m`/`.retry.15m`/`.dlq`): only the naming + header primitives are built in `kafka-kit` this pass, unit-tested. No live retry-topic consumers are wired in `orchestrator`/`ledger` — the required path is happy-path only.
3. **Redis** (idempotency-key registry, outbox-relay leader lock) is used directly via an `ioredis` provider inside `payments-api`. `cache-kit` stays a README-only stub this pass; it gets built when `fx-quote` needs quote-cache TTLs.
4. **Idempotent chain, no per-hop outbox beyond payments-api:** `orchestrator` and `ledger` each guard their DB write with a unique constraint (`payment_saga.payment_id`, `posting_batches(payment_id, phase)`). On redelivery the write becomes a no-op and the handler still (re-)publishes downstream — a duplicate downstream message is absorbed the same way one hop further down. This satisfies "duplicate delivery → no-op" end-to-end without a second outbox table per app.
5. **Ledger schema is two tables**, not one: `posting_batches` (one row per `(payment_id, phase)`, unique) is the idempotency gate, and `journal_entries` (line rows, FK to batch) holds the debit/credit lines. The balanced-batch invariant is a Postgres deferred constraint trigger checking `sum(debit) = sum(credit)` per `batch_id`, per currency.
6. **Kafka wiring in NestJS is raw KafkaJS inside `kafka-kit`**, not `@nestjs/microservices`' Kafka transport — that transport doesn't give clean control over commit-after-transaction ordering or header-based retry metadata.
7. **dependency-cruiser** (not eslint `no-restricted-imports`) enforces layering — better suited to folder-to-folder rules, runs as a Turborepo root task (`//#lint`) so `turbo run lint` fails on a violation.
8. **Scope cuts, explicit:** no `payment.commands.v1` (nothing in the required path consumes a payment command), no failure/compensation event schemas, no capture/settle/reverse posting phases — only `reserve`. These are gaps to fill in a later pass, not oversights.

---

## Package Graph

```
apps/payments-api ──┐
apps/orchestrator ───┼──► packages/domain, packages/contracts, packages/platform/kafka-kit
apps/ledger ─────────┘
packages/platform/kafka-kit ──► packages/domain, packages/contracts
packages/domain ──► (nothing)
packages/contracts ──► zod (only)
```

dependency-cruiser forbidden edges: `domain → *` (anything), `contracts → domain`, `contracts → platform/*`, `contracts → apps/*`, `platform/* → apps/*`. Everything else inside those constraints is allowed.

## File Tree

```
monorepo-nestjs/
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
├── tsconfig.base.json
├── eslint.config.mjs
├── .dependency-cruiser.cjs
├── docker-compose.yml
├── .env.example
├── docs/superpowers/plans/2026-08-06-cross-border-payment-ledger-scaffold.md
│
├── packages/
│   ├── domain/
│   │   ├── package.json, tsconfig.json, vitest.config.ts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── money.ts               # Money value object: bigint minorUnits + currency
│   │       ├── money.test.ts
│   │       ├── errors.ts              # DomainError, UnbalancedBatchError, CurrencyMismatchError
│   │       ├── payment-intent.ts      # PaymentIntent model
│   │       ├── posting-batch.ts       # PostingBatchDraft, assertBalanced()
│   │       ├── posting-batch.test.ts
│   │       ├── saga.ts                # SagaState, decideNextStep()
│   │       ├── saga.test.ts
│   │       └── ports/
│   │           ├── event-publisher.ts
│   │           ├── ledger-repository.ts
│   │           ├── quote-provider.ts   # interface only, unused this pass
│   │           └── object-store.ts     # interface only, unused this pass
│   │
│   ├── contracts/
│   │   ├── package.json, tsconfig.json, vitest.config.ts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── envelope.ts            # shared envelope shape (version, paymentId, type, occurredAt)
│   │       ├── topics.ts              # topic name constants
│   │       ├── payment-events.ts      # PaymentInitiatedEventV1
│   │       ├── payment-events.test.ts
│   │       ├── ledger-commands.ts     # ReservePostingCommandV1
│   │       ├── ledger-commands.test.ts
│   │       ├── ledger-events.ts       # PostingReservedEventV1
│   │       └── ledger-events.test.ts
│   │
│   └── platform/
│       ├── kafka-kit/
│       │   ├── package.json, tsconfig.json, vitest.config.ts
│       │   └── src/
│       │       ├── index.ts
│       │       ├── kafka.module.ts         # NestJS dynamic module, DI token for EventPublisher
│       │       ├── kafka-event-publisher.ts # implements domain EventPublisher via kafkajs Producer
│       │       ├── consumer-runner.ts      # generic run-loop: decode → validate → handle → commit
│       │       ├── retry-topics.ts         # retryTopicName(base, tier)
│       │       ├── retry-topics.test.ts
│       │       ├── retry-headers.ts        # attempt-count/original-topic header helpers
│       │       └── retry-headers.test.ts
│       ├── cache-kit/README.md         # stub: Redis adapters, built when fx-quote needs it
│       ├── storage-kit/README.md       # stub: MinIO/S3 adapters, built when document-service needs it
│       └── observability/README.md     # stub: Pino + OTel wiring, built alongside first deploy target
│
├── apps/
│   ├── payments-api/
│   │   ├── package.json, tsconfig.json, drizzle.config.ts
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── payments/
│   │       │   ├── payments.controller.ts   # POST /payments
│   │       │   ├── payments.module.ts
│   │       │   ├── payments.service.ts      # validate → idempotency check → tx(intent+outbox)
│   │       │   ├── create-payment.dto.ts    # zod-validated request shape
│   │       │   └── payments.service.test.ts
│   │       ├── idempotency/
│   │       │   ├── idempotency.service.ts   # Redis SETNX 24h TTL, DB unique as backstop
│   │       │   └── redis.provider.ts
│   │       ├── outbox/
│   │       │   ├── outbox-relay.service.ts  # interval poll + Redis leader lock + publish
│   │       │   └── outbox-relay.module.ts
│   │       └── db/
│   │           ├── schema.ts                # payment_intents, outbox
│   │           ├── client.ts
│   │           └── migrations/0000_init.sql
│   │
│   ├── orchestrator/
│   │   ├── package.json, tsconfig.json, drizzle.config.ts
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── saga/
│   │       │   ├── saga.consumer.ts   # consumes payment.events.v1
│   │       │   ├── saga.module.ts
│   │       │   ├── saga.service.ts    # upsert-if-absent, decideNextStep, publish command
│   │       │   └── saga.service.test.ts
│   │       └── db/
│   │           ├── schema.ts          # payment_saga
│   │           ├── client.ts
│   │           └── migrations/0000_init.sql
│   │
│   ├── ledger/
│   │   ├── package.json, tsconfig.json, drizzle.config.ts
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── postings/
│   │       │   ├── postings.consumer.ts       # consumes ledger.commands.v1
│   │       │   ├── postings.module.ts
│   │       │   ├── ledger-repository.drizzle.ts  # implements domain LedgerRepository port
│   │       │   └── ledger-repository.drizzle.test.ts
│   │       └── db/
│   │           ├── schema.ts                  # posting_batches, journal_entries
│   │           ├── client.ts
│   │           └── migrations/
│   │               ├── 0000_init.sql
│   │               └── 0001_balanced_batch_trigger.sql
│   │
│   ├── fx-quote/{package.json, README.md}
│   ├── risk-screening/{package.json, README.md}
│   ├── payout-connector/{package.json, README.md}
│   └── document-service/{package.json, README.md}
│
└── test/
    └── e2e/
        ├── package.json
        └── payment-reserve-flow.test.ts   # testcontainers: Postgres×3, Kafka, Redis
```

## Build Order

### Phase 0 — Workspace & tooling
Root `package.json`, `pnpm-workspace.yaml` (`apps/*`, `packages/*`, `packages/platform/*`, `test/e2e`), `turbo.json` (pipeline: `build`, `lint` incl. `//#lint` root task for dependency-cruiser, `test`), `tsconfig.base.json`, `eslint.config.mjs`, `.dependency-cruiser.cjs` (layering rules above), `docker-compose.yml` (Postgres 16, Redis 7, Kafka in KRaft mode, MinIO), `.env.example`.
Checkpoint: `pnpm install`, `turbo run lint`, `turbo run test` — both succeed trivially (no packages yet).

### Phase 1 — `packages/domain`
Money, errors, PaymentIntent, PostingBatch + `assertBalanced`, SagaState + `decideNextStep`, all four ports.
Checkpoint: `pnpm --filter domain lint && pnpm --filter domain test`.

### Phase 2 — `packages/contracts`
Envelope shape, topic constants, the three schemas (`PaymentInitiatedEventV1`, `ReservePostingCommandV1`, `PostingReservedEventV1`), each with `version: z.literal(1)`.
Checkpoint: `pnpm --filter contracts lint && pnpm --filter contracts test`.

### Phase 3 — `packages/platform/kafka-kit` + platform stubs
`KafkaEventPublisher` (implements domain `EventPublisher`), `ConsumerRunner` (validate via contracts schema, run handler, commit offset after), retry-topic naming + header helpers (unit tests only — not wired live). `cache-kit`, `storage-kit`, `observability` get `package.json` + `README.md` stubs.
Checkpoint: `pnpm --filter kafka-kit lint && pnpm --filter kafka-kit test`.

### Phase 4 — `apps/payments-api`
Drizzle schema (`payment_intents`, `outbox`), `POST /payments` (validate → Redis idempotency check → single tx: insert intent + outbox row), outbox relay (interval poll, Redis leader lock, publish via `kafka-kit`, mark published).
Checkpoint: `pnpm --filter payments-api lint && pnpm --filter payments-api test`.

### Phase 5 — `apps/orchestrator`
Drizzle schema (`payment_saga`), consumer on `payment.events.v1`: upsert-if-absent saga row, `decideNextStep` → publish `ReservePosting` to `ledger.commands.v1`, commit offset after tx.
Checkpoint: `pnpm --filter orchestrator lint && pnpm --filter orchestrator test`.

### Phase 6 — `apps/ledger`
Drizzle schema (`posting_batches`, `journal_entries`, deferred balanced-batch constraint trigger), `LedgerRepository` adapter, consumer on `ledger.commands.v1`: `assertBalanced` (defense-in-depth) → insert batch (`ON CONFLICT DO NOTHING`) → insert lines if new → publish `PostingReserved` to `ledger.events.v1` → commit offset.
Checkpoint: `pnpm --filter ledger lint && pnpm --filter ledger test`.

### Phase 7 — Stub apps
`fx-quote`, `risk-screening`, `payout-connector`, `document-service`: `package.json` (name + `private: true`, no scripts) + `README.md` describing responsibility from the spec's services table.
Checkpoint: `turbo run lint && turbo run test` across the whole repo — everything still green.

### Phase 8 — Integration test
`test/e2e/payment-reserve-flow.test.ts`: testcontainers spins up Postgres, Kafka, Redis; boot `payments-api`, `orchestrator`, `ledger` in-process against them; `POST /payments`; assert a balanced `journal_entries` batch lands in `ledger`'s DB and `ledger.events.v1` carries `PostingReserved`.
Checkpoint: this test run (needs Docker available).

---

## Self-Review

- **Spec coverage:** layering + enforcement (Phase 0/3), domain invariants as unit tests (Phase 1), contracts with version discriminator (Phase 2), kafka-kit adapter + retry-header primitives (Phase 3), payments-api idempotency+outbox (Phase 4), orchestrator as sole decision-maker (Phase 5), ledger as sole journal writer with DB-enforced balance + dedup (Phase 6), stub apps with README (Phase 7), e2e testcontainers test (Phase 8), docker-compose with all four infra pieces (Phase 0). `fx-quote`/`risk-screening`/`payout-connector`/`document-service` internals, `cache-kit`/`storage-kit`/`observability` internals, retry-consumer wiring, and reversal/compensation postings are explicitly out of scope this pass per spec and the locked-in decisions above.
- **No placeholders:** file tree lists concrete files only; no "similar to X" left implicit.
- **Naming consistency check:** `EventPublisher.publish`, `LedgerRepository` (reserve-postings method), `assertBalanced`, `decideNextStep` are the names used consistently across domain/contracts/kafka-kit/app descriptions above — will hold these exact names when implementing.
