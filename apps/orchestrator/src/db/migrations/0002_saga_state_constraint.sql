-- 0001 added the widened state list under a constraint name that did not match
-- the one 0000 created, leaving the original three-state check in force.
-- Migrations are immutable once applied, so this repairs it going forward.
ALTER TABLE payment_saga
  DROP CONSTRAINT IF EXISTS payment_saga_state_check,
  DROP CONSTRAINT IF EXISTS payment_saga_state_known;

ALTER TABLE payment_saga
  ADD CONSTRAINT payment_saga_state_check CHECK (state IN (
    'STARTED', 'RESERVING', 'RESERVED', 'SCREENING', 'CAPTURING',
    'CAPTURED', 'PAYING_OUT', 'COMPLETED', 'COMPENSATING', 'FAILED'
  ));
