import { getOperator, operatorErrorResponse } from "../../../../lib/operator";
import { listBetaAccessRequests, reviewBetaAccessRequest, type BetaAccessStatus } from "../../../../lib/beta";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!getOperator(request)) return operatorErrorResponse();
  const status = new URL(request.url).searchParams.get("status") as BetaAccessStatus | null;
  const valid = status && ["pending", "approved", "invited", "rejected"].includes(status) ? status : undefined;
  return Response.json({ requests: await listBetaAccessRequests(runtimeEnv.DB, valid) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  const operator = getOperator(request);
  if (!operator) return operatorErrorResponse();
  try {
    const body = await request.json() as { requestId?: string; action?: "approve" | "reject" | "mark_invited"; note?: string };
    if (!body.requestId || !body.action) return Response.json({ error: "requestId와 action이 필요합니다." }, { status: 400 });
    return Response.json({ ok: true, result: await reviewBetaAccessRequest(runtimeEnv.DB, body.requestId, body.action, operator.id, body.note?.trim().slice(0, 500) || null) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "베타 신청을 처리하지 못했습니다." }, { status: 400 });
  }
}
