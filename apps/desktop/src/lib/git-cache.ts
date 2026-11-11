// In-memory stale-while-revalidate for per-repo git payloads. Remounting the
// dock paints the last answer immediately; a quiet refresh follows.

const TTL_MS = 60_000;

type Entry = { at: number; value: unknown };
const memory = new Map<string, Entry>();
const pending = new Map<string, Promise<unknown>>();

export function gitCacheKey(kind: string, path: string, ...rest: string[]): string {
  return ["git", kind, path, ...rest].join("\0");
}

/** Last value for `key`, even if past TTL (stale paint). */
export function peekGitCache<T>(key: string): T | null {
  const hit = memory.get(key);
  return hit ? (hit.value as T) : null;
}

export function putGitCache<T>(key: string, value: T): void {
  memory.set(key, { at: Date.now(), value });
}

/** Drop every entry for a repo path (after a mutation). */
export function invalidateGitPath(path: string): void {
  // Keys are git\0kind\0path\0...
  for (const key of [...memory.keys()]) {
    const parts = key.split("\0");
    if (parts[2] === path) memory.delete(key);
  }
}

function loadOnce<T>(key: string, load: () => Promise<T>): Promise<T> {
  const active = pending.get(key);
  if (active) return active as Promise<T>;
  const request = Promise.resolve().then(load);
  pending.set(key, request);
  const clear = () => {
    pending.delete(key);
  };
  void request.then(clear, clear);
  return request;
}

/** Fresh if within TTL; otherwise still returns stale and callers should refresh. */
export function gitCacheFresh(key: string): boolean {
  const hit = memory.get(key);
  return !!hit && Date.now() - hit.at < TTL_MS;
}

/** Fetch, store, return. Coalesces in-flight requests for the same key. */
export async function fetchGitCached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const value = await loadOnce(key, load);
  putGitCache(key, value);
  return value;
}
