import { getOperator, operatorErrorResponse } from "../../../../lib/operator";
import { getUsageMetrics } from "../../../../lib/usage";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!getOperator(request)) return operatorErrorResponse();
  try {
    const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
    return Response.json({ usage: await getUsageMetrics(runtimeEnv.DB, days) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "사용 통계를 불러오지 못했습니다." }, { status: 500 });
  }
}
