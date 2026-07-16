// Shared Google Sheets gateway helper.
// - In-memory TTL cache keyed by URL
// - In-flight request dedup (thundering-herd protection)
// - Retries on 429 / 5xx with exponential backoff + Retry-After

type CacheEntry = { at: number; ttl: number; body: string; status: number };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<Response>>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export interface GwFetchOptions {
  headers?: Record<string, string>;
  method?: string;
  body?: string;
  /** cache TTL in ms for successful GETs (default 5 minutes). Set 0 to disable. */
  ttlMs?: number;
  /** max retry attempts on 429/5xx (default 4) */
  maxRetries?: number;
}

export async function gwFetch(url: string, opts: GwFetchOptions = {}): Promise<Response> {
  const method = opts.method ?? "GET";
  const ttl = opts.ttlMs ?? 5 * 60_000;
  const key = `${method} ${url}`;
  const staleHit = method === "GET" && ttl > 0 ? cache.get(key) : undefined;

  if (method === "GET" && ttl > 0) {
    if (staleHit && Date.now() - staleHit.at < staleHit.ttl) {
      return new Response(staleHit.body, { status: staleHit.status });
    }
    const pending = inflight.get(key);
    if (pending) return (await pending).clone();
  }

  const doFetch = async (): Promise<Response> => {
    const maxRetries = opts.maxRetries ?? 4;
    let attempt = 0;
    while (true) {
      const res = await fetch(url, {
        method,
        headers: opts.headers,
        body: opts.body,
      });
      if (res.status !== 429 && res.status < 500) {
        if (method === "GET" && res.ok && ttl > 0) {
          const body = await res.clone().text();
          cache.set(key, { at: Date.now(), ttl, body, status: res.status });
        }
        return res;
      }
      if (attempt >= maxRetries) {
        if (staleHit) return new Response(staleHit.body, { status: staleHit.status });
        return res;
      }
      const retryAfter = Number(res.headers.get("retry-after"));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(30_000, 500 * Math.pow(2, attempt)) + Math.floor(Math.random() * 250);
      await sleep(backoff);
      attempt++;
    }
  };

  const promise = doFetch();
  if (method === "GET" && ttl > 0) {
    inflight.set(key, promise);
    promise.finally(() => inflight.delete(key));
  }
  const res = await promise;
  return method === "GET" && ttl > 0 ? res.clone() : res;
}

export function invalidateGwCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const k of cache.keys()) {
    if (k.includes(prefix)) cache.delete(k);
  }
}