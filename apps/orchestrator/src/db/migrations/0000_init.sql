CREATE TABLE payment_saga (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id  text NOT NULL,
  state       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_saga_state_check CHECK (state IN ('STARTED', 'RESERVING', 'RESERVED'))
);

CREATE UNIQUE INDEX payment_saga_payment_id_uq ON payment_saga (payment_id);
