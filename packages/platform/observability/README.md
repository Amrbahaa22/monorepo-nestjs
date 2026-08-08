# @monorepo/observability

Pino logging and OpenTelemetry tracing wiring. Not implemented in this pass.

Scope when built:
- Structured Pino logger with `payment_id` bound to every log line
- OTel trace context propagated through Kafka headers so one payment is a single trace
  across payments-api → orchestrator → ledger
