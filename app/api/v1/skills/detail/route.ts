import { getPublishedSkill } from "../../../../../lib/sync";
import { runtimeEnv } from "../../../../../lib/runtime-env";
import { enforceD1RateLimit, rateLimitHeaders, requestNetworkIdentity } from "../../../../../lib/rate-limit";

export const dynamic = "force-dynamic";

function headers() {
  return {
    "access-control-allow-origin": "*",
    "cache-control": "public, max-age=60, stale-while-revalidate=300",
    "content-type": "application/json; charset=utf-8",
  };
}

function decodeSkillId(value: string) {
  let decoded = value;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded.trim();
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
  const rawId = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  const id = rawId ? decodeSkillId(rawId) : "";
  if (!id || id.length > 500) return Response.json({ error: "유효한 Skill ID가 필요합니다." }, { status: 400, headers: { ...headers(), ...limitHeaders } });
  const skill = await getPublishedSkill(runtimeEnv.DB, id);
  if (!skill) return Response.json({ error: "공개된 Skill을 찾을 수 없습니다." }, { status: 404, headers: { ...headers(), ...limitHeaders } });
  return Response.json({ data: skill, meta: { generatedAt: new Date().toISOString() } }, { headers: { ...headers(), ...limitHeaders } });
}
