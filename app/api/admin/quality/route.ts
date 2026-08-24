import { getOperator, operatorErrorResponse } from "../../../../lib/operator";
import { getQualitySummary, runQualityChecks } from "../../../../lib/quality";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!getOperator(request)) return operatorErrorResponse();
  try {
    return Response.json(await getQualitySummary(runtimeEnv.DB), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "품질 점검 결과를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!getOperator(request)) return operatorErrorResponse();
  try {
    return Response.json(await runQualityChecks(runtimeEnv), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "품질 점검을 실행하지 못했습니다." }, { status: 500 });
  }
}
