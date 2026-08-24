import { getOperator, operatorErrorResponse } from "../../../../lib/operator";
import { listVerificationJobs, requestSandboxVerification, runStaticVerification } from "../../../../lib/verification";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!getOperator(request)) return operatorErrorResponse();
  const skillId = new URL(request.url).searchParams.get("skillId")?.trim();
  if (!skillId) return Response.json({ error: "skillId가 필요합니다." }, { status: 400 });
  try {
    return Response.json({ jobs: await listVerificationJobs(runtimeEnv.DB, skillId) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "검증 이력을 불러오지 못했습니다." }, { status: 404 });
  }
}

export async function POST(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  const operator = getOperator(request);
  if (!operator) return operatorErrorResponse();
  try {
    const body = await request.json() as { skillId?: string; mode?: string };
    if (!body.skillId || !body.mode || !["static", "sandbox"].includes(body.mode)) {
      return Response.json({ error: "skillId와 static 또는 sandbox mode가 필요합니다." }, { status: 400 });
    }
    const result = body.mode === "static"
      ? await runStaticVerification(runtimeEnv, body.skillId, operator)
      : await requestSandboxVerification(runtimeEnv, body.skillId, operator, `${new URL(request.url).origin}/api/admin/verification/callback`);
    return Response.json(result, { status: result.jobStatus === "unavailable" || result.jobStatus === "queued" ? 202 : 200 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "검증을 실행하지 못했습니다." }, { status: 409 });
  }
}
