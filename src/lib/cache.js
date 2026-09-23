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

/** @type {Map<string, { value?: unknown, inflight?: Promise<unknown>, expiresAt: number, tags: string[] }>} */
const entries = new Map();

// Fresh value (or shared in-flight promise) for `key`, else run `loader`.
// `ttl` may be Infinity for session-stable data (CSVs).
export function cached(key, loader, { ttl = DEFAULT_TTL_MS, tags = [] } = {}) {
  const now = Date.now();
  const e = entries.get(key);
  if (e && e.expiresAt > now) {
    if (e.inflight) return e.inflight;
    return Promise.resolve(e.value);
  }
  if (e) entries.delete(key);

  const inflight = Promise.resolve()
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
export function peek(key) {
  const e = entries.get(key);
  if (!e || e.expiresAt <= Date.now()) return undefined;
  if (e.inflight) return undefined; // resolved value only
  return e.value;
}

// Drop one key (after a mutation that makes it stale).
export function forget(key) {
  entries.delete(key);
}

// Drop every entry carrying `tag` (bulk invalidation, e.g. all relation
// caches for a pair of users).
export function invalidateTag(tag) {
  for (const [key, e] of entries) {
    if (e.tags.includes(tag)) entries.delete(key);
  }
}

export function clearCache() {
  entries.clear();
}
