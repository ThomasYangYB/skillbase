import { runtimeEnv } from "../../../../../lib/runtime-env";
import { recordOpsAlerts } from "../../../../../lib/alerts";

export const dynamic = "force-dynamic";

type CallbackBody = {
  jobId?: string;
  sourceHash?: string;
  status?: "passed" | "failed";
  verificationMethod?: "official_cli" | "integrity_fallback";
  summary?: string;
  findings?: unknown[];
};

function authorized(request: Request) {
  const token = runtimeEnv.SKILLBASE_SANDBOX_TOKEN;
  if (!token) return false;
  return request.headers.get("authorization") === `Bearer ${token}`;
}

export async function POST(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!authorized(request)) return Response.json({ error: "Sandbox callback 인증이 필요합니다." }, { status: 401 });
  try {
    const body = await request.json() as CallbackBody;
    if (!body.jobId || !body.sourceHash || !body.status || !["passed", "failed"].includes(body.status)) {
      return Response.json({ error: "jobId, sourceHash, status가 필요합니다." }, { status: 400 });
    }
    const job = await runtimeEnv.DB.prepare("SELECT skill_id, source_hash FROM skill_verification_jobs WHERE id = ? AND mode = 'sandbox'").bind(body.jobId).first<{ skill_id: string; source_hash: string }>();
    if (!job) return Response.json({ error: "검증 작업을 찾을 수 없습니다." }, { status: 404 });
    if (job.source_hash !== body.sourceHash) return Response.json({ error: "검증 대상 해시가 현재 Skill과 일치하지 않습니다." }, { status: 409 });
    const finishedAt = new Date().toISOString();
    const summary = body.summary?.trim() || (body.status === "passed" ? "격리 환경 설치 검증을 통과했습니다." : "격리 환경 설치 검증에 실패했습니다.");
    const findings = Array.isArray(body.findings) ? body.findings : [];
    const verificationStatus = body.status === "passed"
      ? body.verificationMethod === "integrity_fallback" ? "sandbox_fallback_passed" : "sandbox_passed"
      : "sandbox_failed";
    await runtimeEnv.DB.batch([
      runtimeEnv.DB.prepare("UPDATE skill_verification_jobs SET status = ?, summary = ?, findings_json = ?, finished_at = ? WHERE id = ? AND source_hash = ?").bind(body.status, summary, JSON.stringify(findings), finishedAt, body.jobId, body.sourceHash),
      runtimeEnv.DB.prepare("UPDATE skills SET verification_status = ?, verification_updated_at = ?, verification_summary = ? WHERE id = ? AND content_hash = ?").bind(verificationStatus, finishedAt, summary, job.skill_id, body.sourceHash),
    ]);
    if (body.status === "failed") await recordOpsAlerts(runtimeEnv, [{ kind: "verification_failure", severity: "critical", title: "Sandbox callback 검증 실패", message: summary, fingerprint: `verification:${body.jobId}:callback-failed` }]);
    return Response.json({ jobId: body.jobId, status: body.status, verificationStatus, summary });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Sandbox callback을 처리하지 못했습니다." }, { status: 400 });
  }
}
