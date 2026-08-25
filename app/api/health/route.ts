import { getSyncStatus } from "../../../lib/sync";
import { runtimeEnv } from "../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();
  if (!runtimeEnv.DB) {
    return Response.json({ status: "degraded", database: "unconfigured", checkedAt }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  try {
    await runtimeEnv.DB.prepare("SELECT 1 AS ok").first();
    const sync = await getSyncStatus(runtimeEnv.DB);
    const latestStatus = String(sync.latestRun?.status ?? "unknown");
    const status = latestStatus === "failed" || latestStatus === "completed_with_errors" ? "degraded" : "ok";
    return Response.json({ status, database: "ok", sync: { latestStatus, lastFinishedAt: sync.latestRun?.finished_at ?? null, activeSkills: sync.activeSkills, pendingReviews: sync.pendingReviews, staleSkills: sync.staleSkills }, checkedAt }, { status: status === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ status: "degraded", database: "error", checkedAt }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
