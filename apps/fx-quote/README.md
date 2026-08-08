# fx-quote

Issues FX quotes with a TTL. Not implemented in this pass.

## Responsibility
Quote a rate for a currency pair, valid until an explicit expiry. Cache in Redis with the
cache TTL matched to the quote expiry — never longer.

## Constraints
- Implements the domain `QuoteProvider` port (`packages/domain/src/ports/quote-provider.ts`).
- Rates are decimal strings, never floating point.
- Redis is a cache, not the source of truth. An expired or missing cache entry means re-quote,
  never "use the last known rate".
- A quote past its expiry is not a quote. Callers must handle expiry, not extend it.
