# monorepo-nestjs

POC: **NestJS microservices in a Bun workspaces + Turborepo monorepo**, orchestrating a cross-border payment saga over Kafka with **per-service Postgres databases** (not one shared app schema).

Presentation deep-dive (HLD, sequence/data-flow diagrams, Turborepo vs multi-repo):  
**[docs/POC-ARCHITECTURE.md](docs/POC-ARCHITECTURE.md)**

---

## What you get

| Service | Role | Port |
|---------|------|------|
| `payments-api` | HTTP ingress, outbox → Kafka | **3000** |
| `orchestrator` | Saga brain | Kafka only |
| `ledger` | Balanced journal | Kafka only |
| `risk-screening` | Screening (stub rules) | Kafka only |
| `payout-connector` | Payout rail (stub) | Kafka only |
| `fx-quote` | FX quotes (off saga path) | **3001** |
| `document-service` | MinIO presigns (off saga path) | **3002** |

Infra (Compose): Postgres 16, Redis 7, Kafka, MinIO.

**Important:** `@monorepo/db-kit` shares DB *wiring/migrations helpers*, not tables. Each DB app owns its schema. Details in the [architecture doc](docs/POC-ARCHITECTURE.md#5-critical-clarification-shared-db-package--shared-database).

---

## Prerequisites

- **Docker Desktop** with WSL2 integration (or another Docker engine Compose can use)
- **Bun** `1.2.x` (see root `packageManager` in `package.json`)
- For host-run apps: Node.js able to run `node dist/main.js` (Compose images use Node 22)

---

## Path A — full Docker demo (recommended for presenting)

```bash
# from repo root
bun install
cp .env.example .env

# build images, start infra, run migrations, start all apps
docker compose up --build
```

Wait until `payments-api`, `orchestrator`, `ledger`, `risk-screening`, and `payout-connector` are up (migrate one-shots should exit successfully first).

### Demo 1 — happy-path payment

```bash
curl -s -X POST http://localhost:3000/payments \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: demo-1' \
  -d '{
    "sourceAccountId": "acct_a",
    "destinationAccountId": "acct_b",
    "amountMinorUnits": "10000",
    "currency": "USD"
  }'
```

Expected: HTTP **202** with `paymentId`, `status: "accepted"`, `duplicate: false`.

Repeat the **same** `Idempotency-Key` — you should get the same `paymentId` with `duplicate: true`.

Saga progress (no HTTP on workers): watch Compose logs:

```bash
docker compose logs -f orchestrator ledger risk-screening payout-connector
```

Happy path ends with orchestrator saga state **COMPLETED** after reserve → screen → capture → payout.

### Demo 2 — risk decline (stub)

Use a sanctioned account id (`acct_sanctioned` or `acct_blocked`):

```bash
curl -s -X POST http://localhost:3000/payments \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: demo-risk-decline' \
  -d '{
    "sourceAccountId": "acct_sanctioned",
    "destinationAccountId": "acct_b",
    "amountMinorUnits": "10000",
    "currency": "USD"
  }'
```

Risk stub declines; orchestrator takes the compensation / failure path (see architecture doc).

### Demo 3 — payout reject (stub)

```bash
curl -s -X POST http://localhost:3000/payments \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: demo-payout-reject' \
  -d '{
    "sourceAccountId": "acct_a",
    "destinationAccountId": "acct_rail_reject",
    "amountMinorUnits": "10000",
    "currency": "USD"
  }'
```

Payout stub rejects destination `acct_rail_reject`.

### Optional — FX quote & documents

```bash
# FX (Redis-cached static rates)
curl -s 'http://localhost:3001/quotes?from=USD&to=EUR&amountMinorUnits=10000'

# Presigned KYC upload URL (MinIO)
curl -s -X POST http://localhost:3002/documents/kyc/upload-url \
  -H 'content-type: application/json' \
  -d '{"customerId":"cust_1","filename":"passport.pdf"}'
```

MinIO console: http://localhost:9001 (default creds from `.env.example`: `minioadmin` / `minioadmin`).

---

## Ports cheat sheet

| Port | Service |
|------|---------|
| 3000 | payments-api |
| 3001 | fx-quote |
| 3002 | document-service |
| 5432 | Postgres (`payments_api`, `orchestrator`, `ledger` DBs) |
| 6379 | Redis |
| 9092 | Kafka (host clients) |
| 9000 / 9001 | MinIO API / console |

---

## Path B — infra in Docker, apps on host (debugging)

```bash
bun install
cp .env.example .env

# infra + topic provisioning only
docker compose up postgres redis kafka minio topics-init -d

# build workspace packages + apps that need dist/
bunx turbo run build \
  --filter=@monorepo/payments-api \
  --filter=@monorepo/orchestrator \
  --filter=@monorepo/ledger \
  --filter=@monorepo/risk-screening \
  --filter=@monorepo/payout-connector \
  --filter=@monorepo/fx-quote \
  --filter=@monorepo/document-service

# migrate DB-owning apps (uses .env URLs → localhost)
(cd apps/payments-api && bun run db:migrate)
(cd apps/orchestrator && bun run db:migrate)
(cd apps/ledger && bun run db:migrate)

# start each app in its own terminal
(cd apps/payments-api && bun run start)
(cd apps/orchestrator && bun run start)
(cd apps/ledger && bun run start)
(cd apps/risk-screening && bun run start)
(cd apps/payout-connector && bun run start)
(cd apps/fx-quote && bun run start)            # optional
(cd apps/document-service && bun run start)    # optional
```

### Manual SQL tip (host without `psql`)

Do **not** use `docker compose exec ... psql -f /host/path` (file is not in the container). Pipe from the host:

```bash
docker compose exec -T postgres psql -U postgres -d payments_api \
  < apps/payments-api/src/db/migrations/0000_init.sql
```

Prefer `bun run db:migrate` / Compose migrate jobs when possible.

---

## Verify quality gates

```bash
bun run lint
bun run test
bun run check:deps   # dependency-cruiser layering rules
```

### E2E (needs a working Docker runtime)

Boots testcontainers (Postgres × 3, Redis, Kafka) and asserts the **reserve** path for payments-api + orchestrator + ledger (not full capture/payout):

```bash
bun run --filter=@monorepo/e2e test:e2e
```

---

## Useful Turbo filters

```bash
# build one app and its dependencies
bunx turbo run build --filter=@monorepo/ledger...

# test only kafka-kit
bunx turbo run test --filter=@monorepo/kafka-kit
```

---

## Further reading

- **[docs/POC-ARCHITECTURE.md](docs/POC-ARCHITECTURE.md)** — system design, sequence/data-flow, NestJS mapping, Turborepo rationale, stub vs real
- `AGENTS.md` — short agent/workspace facts
- App READMEs under `apps/*/README.md` and `packages/platform/*/README.md` — package responsibilities (some headers may lag implementation; trust the code + architecture doc)
