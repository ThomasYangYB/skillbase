type RateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetAt: number;
};

async function fingerprint(scope: string, identity: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${scope}:${identity}`));
  return `${scope}:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 48)}`;
}

export async function enforceD1RateLimit(db: D1Database, scope: string, identity: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const resetAt = windowStart + windowSeconds;
  const key = await fingerprint(scope, identity);
  const updatedAt = new Date().toISOString();

  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS request_rate_limits (key TEXT NOT NULL, window_start INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY (key, window_start))"),
    db.prepare("INSERT INTO request_rate_limits (key, window_start, count, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(key, window_start) DO UPDATE SET count = request_rate_limits.count + 1, updated_at = excluded.updated_at").bind(key, windowStart, updatedAt),
  ]);

  const row = await db.prepare("SELECT count FROM request_rate_limits WHERE key = ? AND window_start = ?").bind(key, windowStart).first<{ count: number }>();
  const count = Number(row?.count ?? limit + 1);
  if (windowStart % (windowSeconds * 16) === 0) {
    await db.prepare("DELETE FROM request_rate_limits WHERE window_start < ?").bind(windowStart - windowSeconds * 2).run();
  }
  return { allowed: count <= limit, count, limit, remaining: Math.max(0, limit - count), resetAt };
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "x-ratelimit-limit": String(result.limit),
    "x-ratelimit-remaining": String(result.remaining),
    "x-ratelimit-reset": String(result.resetAt),
    ...(result.allowed ? {} : { "retry-after": String(Math.max(1, result.resetAt - Math.floor(Date.now() / 1000))) }),
  };
}

export async function requestNetworkIdentity(request: Request) {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const agent = request.headers.get("user-agent") ?? "unknown";
  const apiKey = request.headers.get("x-api-key")?.trim().slice(0, 160) ?? "";
  return `${ip}|${agent}|${apiKey}`;
}
