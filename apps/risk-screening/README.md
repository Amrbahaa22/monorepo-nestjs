# risk-screening

Sanctions/AML decision per payment. Not implemented in this pass.

## Responsibility
Screen a payment against sanctions and AML rules, return a decision the orchestrator acts on.

## Constraints
- Consumes `risk.commands.v1`, emits `risk.events.v1`. Never decides what happens next — that
  is the orchestrator's job. This service answers a question; it does not direct the flow.
- Decisions are recorded facts with the ruleset version that produced them. A screening result
  is only meaningful alongside the rules in force at the time.
- A screening hit is a business outcome, not an error. It routes through the saga, not the DLQ.
