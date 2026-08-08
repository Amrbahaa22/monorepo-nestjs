export const RETRY_TIERS = ["5s", "1m", "15m"] as const;

export type RetryTier = (typeof RETRY_TIERS)[number];

export const RETRY_DELAYS_MS: Record<RetryTier, number> = {
  "5s": 5_000,
  "1m": 60_000,
  "15m": 900_000,
};

/** Milliseconds still to wait before a message on this tier may be retried. */
export function remainingDelayMs(
  tier: RetryTier,
  producedAtMs: number,
  nowMs: number,
): number {
  const due = producedAtMs + RETRY_DELAYS_MS[tier];
  return Math.max(0, due - nowMs);
}

export function retryTopicName(baseTopic: string, tier: RetryTier): string {
  return `${baseTopic}.retry.${tier}`;
}

export function dlqTopicName(baseTopic: string): string {
  return `${baseTopic}.dlq`;
}

export function nextRetryTarget(baseTopic: string, attempt: number): string {
  if (attempt < 0) {
    throw new Error(`attempt must be >= 0, got ${attempt}`);
  }
  const tier = RETRY_TIERS[attempt];
  return tier === undefined
    ? dlqTopicName(baseTopic)
    : retryTopicName(baseTopic, tier);
}

/** Every topic a ladder needs provisioned: the base, each tier, and the dlq. */
export function ladderTopicNames(baseTopic: string): string[] {
  return [
    baseTopic,
    ...RETRY_TIERS.map((tier) => retryTopicName(baseTopic, tier)),
    dlqTopicName(baseTopic),
  ];
}
