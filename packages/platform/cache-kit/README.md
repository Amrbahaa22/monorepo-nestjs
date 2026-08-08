# @monorepo/cache-kit

Redis (ioredis) adapters. Not implemented in this pass.

Scope when built:
- FX quote cache, TTL matched to quote expiry
- Per-key rate limits
- Leader lock primitive (currently inlined in `apps/payments-api` for the outbox relay)

Redis is a cache and a lock. Never the source of truth for anything in the ledger.
