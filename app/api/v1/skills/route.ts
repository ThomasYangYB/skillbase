import { listStoredSkills } from "../../../../lib/sync";
import { runtimeEnv } from "../../../../lib/runtime-env";
import { enforceD1RateLimit, rateLimitHeaders, requestNetworkIdentity } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";

function clean(value: string | null, max = 80) {
  return (value ?? "").trim().slice(0, max);
}

function headers() {
  return {
    "access-control-allow-origin": "*",
    "cache-control": "public, max-age=60, stale-while-revalidate=300",
    "content-type": "application/json; charset=utf-8",
  };
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...headers(), "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type" } });
}

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503, headers: headers() });
  let rateLimit;
  try {
    rateLimit = await enforceD1RateLimit(runtimeEnv.DB, "public-api", await requestNetworkIdentity(request), 120, 3600);
  } catch {
    return Response.json({ error: "공개 API 호출 제한기를 초기화하지 못했습니다." }, { status: 503, headers: headers() });
  }
  const limitHeaders = rateLimitHeaders(rateLimit);
  if (!rateLimit.allowed) return Response.json({ error: "공개 API는 한 시간에 120회까지 호출할 수 있습니다.", resetAt: rateLimit.resetAt }, { status: 429, headers: { ...headers(), ...limitHeaders } });
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50) || 50, 1), 100);
  const skills = await listStoredSkills(
    runtimeEnv.DB,
    clean(url.searchParams.get("q")),
    clean(url.searchParams.get("region"), 10),
    clean(url.searchParams.get("category")),
    clean(url.searchParams.get("verification"), 40),
    clean(url.searchParams.get("sort"), 20) || "recommended",
    limit,
    clean(url.searchParams.get("platform"), 40),
  );
  return Response.json({ data: skills, meta: { count: skills.length, limit, generatedAt: new Date().toISOString() } }, { headers: { ...headers(), ...limitHeaders } });
}
