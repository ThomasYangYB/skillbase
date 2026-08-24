import { getStoredSkillRecord } from "../../../lib/sync";
import { recordUsageEvent, USAGE_EVENT_TYPES, type UsageEventType } from "../../../lib/usage";
import { runtimeEnv } from "../../../lib/runtime-env";

export const dynamic = "force-dynamic";

async function anonymousKey(request: Request) {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const agent = request.headers.get("user-agent") ?? "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}|${agent}`));
  return `anon:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32)}`;
}

export async function POST(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 1200) return Response.json({ error: "사용 이벤트 요청이 너무 큽니다." }, { status: 413 });
  try {
    const body = JSON.parse(raw) as { skillId?: string; event?: string };
    const skillId = body.skillId?.trim();
    const event = body.event as UsageEventType;
    if (!skillId || skillId.length > 240 || !USAGE_EVENT_TYPES.includes(event)) return Response.json({ error: "skillId와 유효한 event가 필요합니다." }, { status: 400 });
    const skill = await getStoredSkillRecord(runtimeEnv.DB, skillId);
    if (!skill || skill.status !== "active" || skill.approval_status !== "published") return Response.json({ error: "공개된 Skill만 통계를 기록할 수 있습니다." }, { status: 404 });
    const actorId = request.headers.get("oai-authenticated-user-id") ?? await anonymousKey(request);
    await recordUsageEvent(runtimeEnv.DB, skillId, event, actorId);
    return Response.json({ ok: true }, { status: 202, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "사용 통계를 기록하지 못했습니다." }, { status: 400 });
  }
}
