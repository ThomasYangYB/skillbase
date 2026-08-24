import { runtimeEnv } from "../../../lib/runtime-env";
import { getSyncStatus, processPendingSkillSummaries, syncAllSources } from "../../../lib/sync";
import { recordOpsAlerts } from "../../../lib/alerts";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = runtimeEnv.SKILLBASE_SYNC_TOKEN;
  return Boolean(expected && request.headers.get("x-skillbase-sync-token") === expected);
}

export async function GET() {
  if (!runtimeEnv.DB) return Response.json({ enabled: false, message: "D1 is not configured" }, { status: 503 });
  return Response.json({ enabled: true, ...(await getSyncStatus(runtimeEnv.DB)) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!authorized(request)) return Response.json({ error: "동기화 토큰이 없거나 유효하지 않습니다." }, { status: 401 });

  try {
    const result = await syncAllSources(runtimeEnv);
    const summaries = await processPendingSkillSummaries(runtimeEnv);
    return Response.json({ ...result, summaries }, { status: result.status === "completed" ? 200 : 207 });
  } catch (error) {
    await recordOpsAlerts(runtimeEnv, [{ kind: "sync_failure", severity: "critical", title: "수동 수집 작업 실패", message: error instanceof Error ? error.message : "동기화에 실패했습니다.", fingerprint: "sync:manual-exception" }]);
    return Response.json({ error: error instanceof Error ? error.message : "동기화에 실패했습니다." }, { status: 500 });
  }
}
