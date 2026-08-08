CREATE TABLE payment_intents (
  id                     uuid PRIMARY KEY,
  idempotency_key        text NOT NULL,
  source_account_id      text NOT NULL,
  destination_account_id text NOT NULL,
  amount_minor_units     bigint NOT NULL,
  currency               text NOT NULL,
  status                 text NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_intents_amount_positive CHECK (amount_minor_units > 0),
  CONSTRAINT payment_intents_currency_iso4217 CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE UNIQUE INDEX payment_intents_idempotency_key_uq ON payment_intents (idempotency_key);

CREATE TABLE outbox (
  id           uuid PRIMARY KEY,
  aggregate_id uuid NOT NULL,
  topic        text NOT NULL,
  message_key  text NOT NULL,
  payload      text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX outbox_unpublished_idx ON outbox (published_at, created_at) WHERE published_at IS NULL;
