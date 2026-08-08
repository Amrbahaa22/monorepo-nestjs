import type { IHeaders } from "kafkajs";

export const HEADER_ATTEMPT = "x-retry-attempt";
export const HEADER_ORIGINAL_TOPIC = "x-original-topic";

export interface RetryContext {
  readonly originalTopic: string;
  readonly attempt: number;
}

export function buildRetryHeaders(context: RetryContext): IHeaders {
  return {
    [HEADER_ORIGINAL_TOPIC]: context.originalTopic,
    [HEADER_ATTEMPT]: String(context.attempt),
  };
}

export function readRetryContext(
  headers: IHeaders | undefined,
  fallbackTopic: string,
): RetryContext {
  const originalTopic =
    decodeHeader(headers?.[HEADER_ORIGINAL_TOPIC]) ?? fallbackTopic;
  const rawAttempt = decodeHeader(headers?.[HEADER_ATTEMPT]);
  const attempt = rawAttempt === undefined ? 0 : Number(rawAttempt);

  if (!Number.isInteger(attempt) || attempt < 0) {
    throw new Error(
      `${HEADER_ATTEMPT} header must be a non-negative integer, got "${rawAttempt}"`,
    );
  }

  return { originalTopic, attempt };
}

function decodeHeader(value: IHeaders[string]): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return Array.isArray(value) ? value[0]?.toString() : value.toString();
}
