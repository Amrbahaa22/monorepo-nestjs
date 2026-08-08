import type { Redis } from "ioredis";

/**
 * Fixed-window counter. INCR then EXPIRE only on first hit, so the window
 * starts at the first request and cannot be extended by later ones.
 */
const LIMIT_SCRIPT = `
local current = redis.call("incr", KEYS[1])
if current == 1 then
  redis.call("expire", KEYS[1], ARGV[1])
end
return current
`;

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly current: number;
}

export class RateLimiter {
  constructor(private readonly redis: Redis) {}

  async hit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const current = (await this.redis.eval(
      LIMIT_SCRIPT,
      1,
      `ratelimit:${key}`,
      windowSeconds,
    )) as number;

    return { allowed: current <= limit, current };
  }
}
