export const TOPICS = {
  paymentEventsV1: "payment.events.v1",
  ledgerCommandsV1: "ledger.commands.v1",
  ledgerEventsV1: "ledger.events.v1",
  riskCommandsV1: "risk.commands.v1",
  riskEventsV1: "risk.events.v1",
  payoutCommandsV1: "payout.commands.v1",
  payoutEventsV1: "payout.events.v1",
  payoutReconcileV1: "payout.reconcile.v1",
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];
