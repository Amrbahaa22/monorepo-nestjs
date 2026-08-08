import type { Redis } from "ioredis";

/**
 * Releases only if this holder still owns the lock. A plain DEL would let a
 * slow holder delete a lock that already expired and was re-acquired by
 * someone else.
 */
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

export class LeaderLock {
  constructor(
    private readonly redis: Redis,
    private readonly key: string,
    private readonly ttlSeconds: number,
  ) {}

  async acquire(holderId: string): Promise<boolean> {
    const result = await this.redis.set(
      this.key,
      holderId,
      "EX",
      this.ttlSeconds,
      "NX",
    );
    return result === "OK";
  }

  async release(holderId: string): Promise<void> {
    await this.redis.eval(RELEASE_SCRIPT, 1, this.key, holderId);
  }
}
