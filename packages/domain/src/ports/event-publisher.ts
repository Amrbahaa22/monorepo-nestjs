export interface EventEnvelope {
  readonly key: string;
  readonly payload: Record<string, unknown>;
}

export interface EventPublisher {
  publish(topic: string, envelope: EventEnvelope): Promise<void>;
}
