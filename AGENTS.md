## Learned User Preferences

## Learned Workspace Facts

- Bun workspaces monorepo (`apps/*`, `packages/*`, `packages/platform/*`) with NestJS backend apps; package manager is `bun@1.2.19`.
- Shared packages include `@monorepo/domain` and `@monorepo/contracts`; platform kits live under `packages/platform/*` (e.g. `kafka-kit`, `db-kit`, `storage-kit`); apps include `payments-api`, `orchestrator`, `ledger`, plus stub apps `fx-quote`, `risk-screening`, `payout-connector`, `document-service`; e2e lives in `test/e2e`.
- Keep root TypeScript pinned to `~5.9.3`; TypeScript 7 breaks `ts-jest` because it lacks the JS compiler API Bun/alias workarounds do not restore.
- Biome `useImportType` is off for `apps/**/*.ts` — Nest DI needs value imports for injectable classes and provider tokens (`emitDecoratorMetadata`).
- Nest apps expose infra via a `@Global()` `InfraModule` that provides/exports `DATABASE` and `REDIS` symbols (same pattern as `KafkaModule`).
- Local infra is `docker compose`: Postgres 16 (DBs `payments_api`, `orchestrator`, `ledger` via `docker/init-db.sh`), Redis, `apache/kafka` (official `KAFKA_*` env vars, not Bitnami `KAFKA_CFG_*`), and MinIO.
- `tsconfig.base.json` is extend-only shared `compilerOptions`; do not run `tsc -p tsconfig.base.json` directly.
- When host `psql` is missing, apply app SQL migrations by piping host files into the container (`docker compose exec -T postgres psql -U postgres -d <db> < apps/<app>/src/db/migrations/...`), not `-f` (paths are not inside the container).
- Root Jest preset matches `**/src/**/*.test.ts` so tests outside `src/` (e.g. nested accidental copies) are not picked up.
