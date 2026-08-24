import { getOperator, operatorErrorResponse } from "../../../../lib/operator";
import { getSyncStatus } from "../../../../lib/sync";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!getOperator(request)) return operatorErrorResponse();
  try {
    const [skills, reviewEvents, verificationJobs, sync] = await Promise.all([
      runtimeEnv.DB.prepare("SELECT * FROM skills ORDER BY updated_at DESC, name ASC").all<Record<string, unknown>>(),
      runtimeEnv.DB.prepare("SELECT * FROM skill_review_events ORDER BY created_at DESC LIMIT 5000").all<Record<string, unknown>>(),
      runtimeEnv.DB.prepare("SELECT * FROM skill_verification_jobs ORDER BY created_at DESC LIMIT 5000").all<Record<string, unknown>>(),
      getSyncStatus(runtimeEnv.DB),
    ]);
    const filename = `skillbase-export-${new Date().toISOString().slice(0, 10)}.json`;
    return Response.json({ exportedAt: new Date().toISOString(), skills: skills.results ?? [], reviewEvents: reviewEvents.results ?? [], verificationJobs: verificationJobs.results ?? [], sync }, {
      headers: { "cache-control": "no-store", "content-disposition": `attachment; filename="${filename}"` },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "백업 파일을 만들지 못했습니다." }, { status: 500 });
  }
}
