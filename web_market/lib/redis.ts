import Redis from "ioredis";

// A shared, fault-tolerant Redis cache layer placed between the front-end and
// MongoDB. When Redis is unavailable every helper degrades gracefully so the
// application keeps reading/writing MongoDB directly (no hard failure).

declare global {
  // eslint-disable-next-line no-var
  var redisClient: Redis | undefined;
}

// TTL in seconds for cached read results. Short enough that even a missed
// invalidation self-heals quickly, long enough to absorb read bursts.
const CACHE_TTL_SECONDS = Number(process.env.REDIS_TTL_SECONDS || 30);

// A single global revision counter. Reads key off it; every write bumps it so
// that all previously cached reads become stale at once. This is the safest
// invalidation model for a document that several endpoints read/write as a
// whole (appState), and it avoids partial-cache staleness bugs.
const REVISION_KEY = "cache:rev:appstate";

export const cacheKey = (scope: string) => `cache:data:${scope}`;

function redisClient(): Redis | undefined {
  const url = process.env.REDIS_URL;
  if (!url) return undefined;
  if (!global.redisClient) {
    global.redisClient = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: false,
      retryStrategy: (attempt) => Math.min(attempt * 200, 1000),
    });
    global.redisClient.on("error", () => undefined);
  }
  return global.redisClient;
}

const readRevision = async (client: Redis) => {
  try {
    return (await client.get(REVISION_KEY)) || "0";
  } catch {
    return "0";
  }
};

const scopedKey = async (scope: string) => {
  const client = redisClient();
  if (!client) return null;
  const revision = await readRevision(client);
  return `${cacheKey(scope)}:v${revision}`;
};

export type CacheResult<T> = { hit: boolean; value: T | null };

export async function cacheGet<T>(scope: string): Promise<CacheResult<T>> {
  const client = redisClient();
  if (!client) return { hit: false, value: null };
  try {
    const key = await scopedKey(scope);
    if (!key) return { hit: false, value: null };
    const cached = await client.get(key);
    if (cached === null) return { hit: false, value: null };
    return { hit: true, value: JSON.parse(cached) as T };
  } catch {
    return { hit: false, value: null };
  }
}

export async function cacheSet<T>(scope: string, value: T): Promise<void> {
  const client = redisClient();
  if (!client) return;
  try {
    const key = await scopedKey(scope);
    if (!key) return;
    await client.set(key, JSON.stringify(value), "EX", CACHE_TTL_SECONDS);
  } catch {
    // Cache write failures must never break the request.
  }
}

// Invalidate everything by bumping the global revision. Old keys are left to
// expire via TTL, which keeps the operation O(1) and safe under concurrency.
export async function cacheInvalidate(): Promise<void> {
  const client = redisClient();
  if (!client) return;
  try {
    await client.incr(REVISION_KEY);
  } catch {
    // If invalidation fails, the TTL still bounds staleness.
  }
}
