import Redis from "ioredis";

// Fault-tolerant Redis cache layer shared with the web_market backend. When
// Redis is unreachable every helper degrades gracefully so the app keeps
// reading/writing MongoDB directly instead of failing the request.

declare global {
  // eslint-disable-next-line no-var
  var bazarakMapRedisClient: Redis | undefined;
}

const CACHE_TTL_SECONDS = Number(process.env.REDIS_TTL_SECONDS || 30);

// A single global revision. The appState document is read/written as a whole,
// so bumping the revision on any write invalidates all cached reads at once.
const REVISION_KEY = "cache:rev:appstate";

export const cacheKey = (scope: string) => `cache:data:${scope}`;

function redisClient(): Redis | undefined {
  const url = process.env.REDIS_URL;
  if (!url) return undefined;
  if (!global.bazarakMapRedisClient) {
    global.bazarakMapRedisClient = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: false,
      retryStrategy: (attempt) => Math.min(attempt * 200, 1000),
    });
    global.bazarakMapRedisClient.on("error", () => undefined);
  }
  return global.bazarakMapRedisClient;
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

export async function cacheInvalidate(): Promise<void> {
  const client = redisClient();
  if (!client) return;
  try {
    await client.incr(REVISION_KEY);
  } catch {
    // If invalidation fails, the TTL still bounds staleness.
  }
}
