# payout-connector

Calls the external payout rail. Not implemented in this pass.

The only component in the system with non-idempotent external side effects.

## Responsibility
Submit a transfer to the partner rail and report its terminal status.

## Constraints — read before writing any code here
- **No blind retries.** The `.retry.5s`/`.retry.1m`/`.retry.15m` topology used elsewhere does
  not apply to this service.
- A timeout from the rail is **ambiguous, not failed**. The transfer may have succeeded. Route
  ambiguous outcomes to `payout.reconcile` and poll the partner for terminal status.
- **Never re-send a transfer because a response was missing.** A missing response is not
  evidence the transfer did not happen.
- Every submission carries a partner-side idempotency reference derived from `payment_id`, so a
  reconciliation poll can identify the transfer without guessing.
