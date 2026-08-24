import { getStoredSkillRecord } from "../../../lib/sync";
import { runtimeEnv } from "../../../lib/runtime-env";
import { recordOpsAlerts } from "../../../lib/alerts";
import { enforceD1RateLimit, rateLimitHeaders } from "../../../lib/rate-limit";

export const dynamic = "force-dynamic";

async function rateKey(request: Request, userId: string | null) {
  if (userId) return `user:${userId}`;
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const agent = request.headers.get("user-agent") ?? "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}|${agent}`));
  return `anon:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32)}`;
}

export async function POST(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return Response.json({ error: "JSON 요청만 허용됩니다." }, { status: 415 });
  const raw = await request.text();
  if (raw.length > 5000) return Response.json({ error: "피드백이 너무 깁니다." }, { status: 413 });
  try {
    const body = JSON.parse(raw) as { skillId?: string; type?: string; message?: string; website?: string };
    if (body.website?.trim()) return Response.json({ ok: true }, { status: 202 });
    const skillId = body.skillId?.trim();
    const type = body.type?.trim();
    const message = body.message?.trim() || null;
    if (!skillId || skillId.length > 240 || !type || !["helpful", "report"].includes(type)) return Response.json({ error: "skillId와 유효한 feedback type이 필요합니다." }, { status: 400 });
    if (type === "report" && (!message || message.length < 3)) return Response.json({ error: "문제 신고 내용을 3자 이상 입력하세요." }, { status: 400 });
    if (message && message.length > 1000) return Response.json({ error: "피드백은 1000자 이내로 입력하세요." }, { status: 400 });
    const skill = await getStoredSkillRecord(runtimeEnv.DB, skillId);
    if (!skill || skill.status !== "active" || skill.approval_status !== "published") return Response.json({ error: "공개된 Skill만 피드백을 남길 수 있습니다." }, { status: 404 });
    const actorId = request.headers.get("oai-authenticated-user-id");
    const key = await rateKey(request, actorId);
    const rateLimit = await enforceD1RateLimit(runtimeEnv.DB, "feedback", key, 5, 3600);
    if (!rateLimit.allowed) return Response.json({ error: "피드백은 한 시간에 5건까지 보낼 수 있습니다." }, { status: 429, headers: rateLimitHeaders(rateLimit) });
    if (type === "report" && message) {
      const duplicate = await runtimeEnv.DB.prepare("SELECT id FROM skill_feedback WHERE skill_id = ? AND actor_id = ? AND type = 'report' AND message = ? AND created_at >= datetime('now', '-1 day') LIMIT 1").bind(skillId, key, message).first<{ id: string }>();
      if (duplicate) return Response.json({ error: "같은 신고가 이미 접수되었습니다." }, { status: 409 });
    }
    await runtimeEnv.DB.prepare("INSERT INTO skill_feedback (id, skill_id, type, message, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), skillId, type, message, key, new Date().toISOString()).run();
    if (type === "report") await recordOpsAlerts(runtimeEnv, [{ kind: "security", severity: "warning", title: "사용자 Skill 신고 접수", message: `${skillId}에 대한 사용자 신고가 접수되었습니다.`, fingerprint: `feedback:report:${skillId}` }]);
    return Response.json({ ok: true }, { status: 201, headers: rateLimitHeaders(rateLimit) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "피드백을 저장하지 못했습니다." }, { status: 400 });
  }
}
