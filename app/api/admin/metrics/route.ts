import { getOperator, operatorErrorResponse } from "../../../../lib/operator";
import { getVerificationMetrics } from "../../../../lib/verification";
import { getSyncStatus } from "../../../../lib/sync";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!getOperator(request)) return operatorErrorResponse();
  const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
  try {
    const sync = await getSyncStatus(runtimeEnv.DB);
    const verification = await getVerificationMetrics(runtimeEnv.DB, days);
    return Response.json({ verification, sync }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "운영 지표를 불러오지 못했습니다." }, { status: 500 });
  }
}
