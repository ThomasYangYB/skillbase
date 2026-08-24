import { getOperator, operatorErrorResponse } from "../../../../lib/operator";
import { getSummaryMetrics, retrySkillSummaries, reviewSkillSummary } from "../../../../lib/sync";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!getOperator(request)) return operatorErrorResponse();
  return Response.json({ summary: await getSummaryMetrics(runtimeEnv.DB) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  const actor = getOperator(request);
  if (!actor) return operatorErrorResponse();
  try {
    const body = await request.json() as { action?: string; skillId?: string; skillIds?: string[]; reviewAction?: string };
    if (body.action === "retry") {
      const ids = Array.isArray(body.skillIds) ? body.skillIds : body.skillId ? [body.skillId] : [];
      return Response.json({ ok: true, retried: await retrySkillSummaries(runtimeEnv.DB, ids) });
    }
    if (body.action === "review" && body.skillId && (body.reviewAction === "approve" || body.reviewAction === "needs_revision")) {
      return Response.json({ ok: true, result: await reviewSkillSummary(runtimeEnv.DB, body.skillId, body.reviewAction, actor) });
    }
    return Response.json({ error: "요약 작업이 올바르지 않습니다." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "요약 작업에 실패했습니다." }, { status: 400 });
  }
}
