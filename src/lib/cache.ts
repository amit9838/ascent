// Centralized in-memory cache for async data.
//
// One cache serves the whole app (CSVs, Firestore docs, derived stats).
// Features:
//   - TTL expiry per entry
//   - tag-based bulk invalidation (invalidateTag)
//   - in-flight promise deduplication: concurrent calls for the same key
//     share one loader execution (no request stampede)
//   - failures are never cached — the entry is dropped and the error
//     propagates to every waiter
//
// Keys are namespaced by convention: "profile:{uid}", "summary",
// "conn:{a}:{b}", "csv:{file}", … All keys are local to this tab's
// memory — Firestore's own persistent cache covers cross-session data.

const DEFAULT_TTL_MS = 30_000;

interface CacheEntry {
  value?: unknown;
  inflight?: Promise<unknown>;
  expiresAt: number;
  tags: string[];
}

const entries = new Map<string, CacheEntry>();

export interface CachedOptions {
  ttl?: number;
  tags?: string[];
}

// Fresh value (or shared in-flight promise) for `key`, else run `loader`.
// `ttl` may be Infinity for session-stable data (CSVs).
export function cached<T>(
  key: string,
  loader: () => T | Promise<T>,
  { ttl = DEFAULT_TTL_MS, tags = [] }: CachedOptions = {}
): Promise<T> {
  const now = Date.now();
  const e = entries.get(key);
  if (e && e.expiresAt > now) {
    if (e.inflight) return e.inflight as Promise<T>;
    return Promise.resolve(e.value as T);
  }
  if (e) entries.delete(key);

  const inflight: Promise<T> = Promise.resolve()
    .then(loader)
    .then(
      (value) => {
        entries.set(key, { value, expiresAt: Date.now() + ttl, tags });
        return value;
      },
      (err) => {
        entries.delete(key);
        throw err;
      }
    );

  entries.set(key, { inflight, expiresAt: Date.now() + ttl, tags });
  return inflight;
}

// Synchronous peek — returns undefined when missing or expired.
export function peek<T = unknown>(key: string): T | undefined {
  const e = entries.get(key);
  if (!e || e.expiresAt <= Date.now()) return undefined;
  if (e.inflight) return undefined; // resolved value only
  return e.value as T | undefined;
}

// Drop one key (after a mutation that makes it stale).
export function forget(key: string): void {
  entries.delete(key);
}

// Drop every entry carrying `tag` (bulk invalidation, e.g. all relation
// caches for a pair of users).
export function invalidateTag(tag: string): void {
  for (const [key, e] of entries) {
    if (e.tags.includes(tag)) entries.delete(key);
  }
}

export function clearCache(): void {
  entries.clear();
}
