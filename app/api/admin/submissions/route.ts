import { getOperator, operatorErrorResponse } from "../../../../lib/operator";
import { getSummaryMetrics } from "../../../../lib/sync";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!getOperator(request)) return operatorErrorResponse();
  await getSummaryMetrics(runtimeEnv.DB);
  const result = await runtimeEnv.DB.prepare("SELECT id, actor_email, name, source_url, source_type, category, description, install, prompt, status, review_note, created_at, reviewed_at FROM skill_submissions WHERE status = 'pending' ORDER BY created_at ASC LIMIT 100").all<Record<string, unknown>>();
  return Response.json({ items: result.results ?? [] }, { headers: { "cache-control": "no-store" } });
}

async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  const actor = getOperator(request);
  if (!actor) return operatorErrorResponse();
  try {
    const body = await request.json() as { submissionId?: string; action?: string; note?: string };
    if (!body.submissionId || !["approve", "reject"].includes(body.action ?? "")) return Response.json({ error: "제출 처리 값이 올바르지 않습니다." }, { status: 400 });
    await getSummaryMetrics(runtimeEnv.DB);
    const submission = await runtimeEnv.DB.prepare("SELECT * FROM skill_submissions WHERE id = ? AND status = 'pending'").bind(body.submissionId).first<Record<string, unknown>>();
    if (!submission) return Response.json({ error: "검토 대기 제출을 찾을 수 없습니다." }, { status: 404 });
    const now = new Date().toISOString();
    if (body.action === "reject") {
      await runtimeEnv.DB.prepare("UPDATE skill_submissions SET status = 'rejected', reviewer_id = ?, review_note = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'").bind(actor.id, String(body.note ?? "").slice(0, 500) || null, now, body.submissionId).run();
      return Response.json({ ok: true, status: "rejected" });
    }
    const skillId = `submitted:${body.submissionId}`;
    const contentHash = await hash([submission.name, submission.source_url, submission.description, submission.install, submission.prompt].join("\n"));
    await runtimeEnv.DB.batch([
      runtimeEnv.DB.prepare("INSERT OR IGNORE INTO skills (id, source_id, name, description, category, region, source, source_url, source_type, compatibility_json, tags_json, install, prompt, app_url, risk, trust, license, content_hash, discovered_via, last_seen_at, status, approval_status, source_link_status, created_at, updated_at) VALUES (?, 'user-submission', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'https://chatgpt.com/', '주의', '검토 필요', NULL, ?, 'user_submission', ?, 'active', 'review', 'unknown', ?, ?)").bind(skillId, submission.name, submission.description, submission.category, String(submission.source_url).includes(".kr") ? "국내" : "해외", new URL(String(submission.source_url)).hostname, submission.source_url, submission.source_type, JSON.stringify(["Agent Skills"]), JSON.stringify([submission.category]), submission.install, submission.prompt, contentHash, now, now, now),
      runtimeEnv.DB.prepare("UPDATE skill_submissions SET status = 'approved', reviewer_id = ?, review_note = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'").bind(actor.id, String(body.note ?? "").slice(0, 500) || "운영자 1차 승인 · 검증 큐로 이동", now, body.submissionId),
      runtimeEnv.DB.prepare("INSERT INTO skill_review_events (id, skill_id, action, from_status, to_status, actor_id, actor_email, note, created_at) VALUES (?, ?, 'submission_approve', NULL, 'review', ?, ?, ?, ?)").bind(crypto.randomUUID(), skillId, actor.id, actor.email, "사용자 제출을 검증 큐로 이동", now),
    ]);
    return Response.json({ ok: true, status: "approved", skillId });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "제출 처리에 실패했습니다." }, { status: 400 });
  }
}
