import { getOperator, operatorErrorResponse } from "../../../../lib/operator";
import { listOpsAlerts, resolveOpsAlert } from "../../../../lib/alerts";
import { getSyncStatus } from "../../../../lib/sync";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!getOperator(request)) return operatorErrorResponse();
  try {
    await getSyncStatus(runtimeEnv.DB);
    const status = new URL(request.url).searchParams.get("status") ?? "open";
    return Response.json({ alerts: await listOpsAlerts(runtimeEnv.DB, status) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "운영 알림을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!getOperator(request)) return operatorErrorResponse();
  try {
    const body = await request.json() as { alertId?: string };
    if (!body.alertId || body.alertId.length > 120) return Response.json({ error: "alertId가 필요합니다." }, { status: 400 });
    await resolveOpsAlert(runtimeEnv.DB, body.alertId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "운영 알림을 처리하지 못했습니다." }, { status: 400 });
  }
}
