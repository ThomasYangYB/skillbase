import { getSummaryMetrics, getSyncStatus } from "../../../lib/sync";
import { getQualitySummary } from "../../../lib/quality";
import { runtimeEnv } from "../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();
  if (!runtimeEnv.DB) {
    return Response.json({ status: "degraded", database: "unconfigured", checkedAt }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  try {
    await runtimeEnv.DB.prepare("SELECT 1 AS ok").first();
    const [sync, summaries, quality] = await Promise.all([getSyncStatus(runtimeEnv.DB), getSummaryMetrics(runtimeEnv.DB), getQualitySummary(runtimeEnv.DB)]);
    const latestStatus = String(sync.latestRun?.status ?? "unknown");
    const status = latestStatus === "failed" || latestStatus === "completed_with_errors" ? "degraded" : "ok";
    const warnings = [
      ...(!runtimeEnv.AI && !runtimeEnv.OPENAI_API_KEY && summaries.pending > 0 ? ["summary_provider_unconfigured"] : []),
      ...(summaries.failed > 0 ? ["summary_generation_failed"] : []),
      ...(quality.blockers > 0 ? ["quality_blockers_open"] : []),
    ];
    return Response.json({ status, database: "ok", warnings, sync: { latestStatus, lastFinishedAt: sync.latestRun?.finished_at ?? null, activeSkills: sync.activeSkills, pendingReviews: sync.pendingReviews, staleSkills: sync.staleSkills }, summaries: { generated: summaries.generated, pending: summaries.pending, failed: summaries.failed, reviewPending: summaries.reviewPending, aiConfigured: Boolean(runtimeEnv.AI || runtimeEnv.OPENAI_API_KEY) }, quality: { open: quality.open, blockers: quality.blockers }, checkedAt }, { status: status === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ status: "degraded", database: "error", checkedAt }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
