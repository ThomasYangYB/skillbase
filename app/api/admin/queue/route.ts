import { changeSkillApproval, listReviewQueue, type ReviewAction } from "../../../../lib/sync";
import { getOperator, operatorErrorResponse } from "../../../../lib/operator";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  const operator = getOperator(request);
  if (!operator) return operatorErrorResponse();
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "review";
  const result = await listReviewQueue(runtimeEnv.DB, status, Number(url.searchParams.get("limit") ?? 100));
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  const operator = getOperator(request);
  if (!operator) return operatorErrorResponse();

  try {
    const body = await request.json() as { skillId?: string; action?: ReviewAction; note?: string };
    if (!body.skillId || !body.action || !["approve", "publish", "reject", "review", "unpublish"].includes(body.action)) {
      return Response.json({ error: "skillId와 유효한 action이 필요합니다." }, { status: 400 });
    }
    const result = await changeSkillApproval(runtimeEnv.DB, body.skillId, body.action, operator, body.note?.trim() || null);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "승인 상태를 변경하지 못했습니다." }, { status: 409 });
  }
}
