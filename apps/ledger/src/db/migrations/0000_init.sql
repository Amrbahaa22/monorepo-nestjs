CREATE TABLE posting_batches (
  id         uuid PRIMARY KEY,
  payment_id uuid NOT NULL,
  phase      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT posting_batches_phase_known CHECK (phase IN ('reserve', 'capture', 'release', 'reverse'))
);

CREATE UNIQUE INDEX posting_batches_payment_phase_uq ON posting_batches (payment_id, phase);

CREATE TABLE journal_entries (
  id                 uuid PRIMARY KEY,
  batch_id           uuid NOT NULL REFERENCES posting_batches (id),
  account_id         text NOT NULL,
  direction          text NOT NULL,
  amount_minor_units bigint NOT NULL,
  currency           text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_entries_direction_known CHECK (direction IN ('debit', 'credit')),
  CONSTRAINT journal_entries_amount_positive CHECK (amount_minor_units > 0),
  CONSTRAINT journal_entries_currency_iso4217 CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX journal_entries_account_idx ON journal_entries (account_id, currency);

REVOKE UPDATE, DELETE ON journal_entries FROM PUBLIC;
