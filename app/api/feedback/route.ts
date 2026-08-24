import { getStoredSkillRecord } from "../../../lib/sync";
import { runtimeEnv } from "../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 5000) return Response.json({ error: "피드백이 너무 깁니다." }, { status: 413 });
  try {
    const body = JSON.parse(raw) as { skillId?: string; type?: string; message?: string };
    const skillId = body.skillId?.trim();
    const type = body.type?.trim();
    const message = body.message?.trim() || null;
    if (!skillId || skillId.length > 240 || !type || !["helpful", "report"].includes(type)) return Response.json({ error: "skillId와 유효한 feedback type이 필요합니다." }, { status: 400 });
    if (type === "report" && (!message || message.length < 3)) return Response.json({ error: "문제 신고 내용을 3자 이상 입력하세요." }, { status: 400 });
    if (message && message.length > 1000) return Response.json({ error: "피드백은 1000자 이내로 입력하세요." }, { status: 400 });
    const skill = await getStoredSkillRecord(runtimeEnv.DB, skillId);
    if (!skill || skill.status !== "active" || skill.approval_status !== "published") return Response.json({ error: "공개된 Skill만 피드백을 남길 수 있습니다." }, { status: 404 });
    await runtimeEnv.DB.prepare("INSERT INTO skill_feedback (id, skill_id, type, message, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), skillId, type, message, request.headers.get("oai-authenticated-user-id"), new Date().toISOString()).run();
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "피드백을 저장하지 못했습니다." }, { status: 400 });
  }
}
