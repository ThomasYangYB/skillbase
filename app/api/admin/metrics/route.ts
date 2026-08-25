import { getOperator, operatorErrorResponse } from "../../../../lib/operator";
import { getVerificationMetrics } from "../../../../lib/verification";
import { getSummaryMetrics, getSummaryProviderStatus, getSyncStatus } from "../../../../lib/sync";
import { getQualitySummary } from "../../../../lib/quality";
import { getUsageMetrics } from "../../../../lib/usage";
import { listOpsAlerts } from "../../../../lib/alerts";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!getOperator(request)) return operatorErrorResponse();
  const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
  try {
    const sync = await getSyncStatus(runtimeEnv.DB);
    const [verification, quality, usage, alerts, summary] = await Promise.all([
      getVerificationMetrics(runtimeEnv.DB, days),
      getQualitySummary(runtimeEnv.DB),
      getUsageMetrics(runtimeEnv.DB, days),
      listOpsAlerts(runtimeEnv.DB, "open", 10),
      getSummaryMetrics(runtimeEnv.DB),
    ]);
    const provider = getSummaryProviderStatus(runtimeEnv);
    return Response.json({ verification, quality, usage, alerts, summary: { ...summary, ...provider, aiConfigured: provider.configured }, sync }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "운영 지표를 불러오지 못했습니다." }, { status: 500 });
  }
}
