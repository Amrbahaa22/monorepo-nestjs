ALTER TABLE payment_saga
  ADD COLUMN source_account_id      text NOT NULL DEFAULT '',
  ADD COLUMN destination_account_id text NOT NULL DEFAULT '',
  ADD COLUMN amount_minor_units     bigint NOT NULL DEFAULT 0,
  ADD COLUMN currency               text NOT NULL DEFAULT 'XXX';

ALTER TABLE payment_saga
  ALTER COLUMN source_account_id      DROP DEFAULT,
  ALTER COLUMN destination_account_id DROP DEFAULT,
  ALTER COLUMN amount_minor_units     DROP DEFAULT,
  ALTER COLUMN currency               DROP DEFAULT;

ALTER TABLE payment_saga
  DROP CONSTRAINT IF EXISTS payment_saga_state_check,
  DROP CONSTRAINT IF EXISTS payment_saga_state_known;

ALTER TABLE payment_saga
  ADD CONSTRAINT payment_saga_state_check CHECK (state IN (
    'STARTED', 'RESERVING', 'RESERVED', 'SCREENING', 'CAPTURING',
    'CAPTURED', 'PAYING_OUT', 'COMPLETED', 'COMPENSATING', 'FAILED'
  ));
