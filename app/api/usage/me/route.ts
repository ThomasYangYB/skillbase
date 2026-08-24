import { getRequestActor } from "../../../../lib/user";
import { getPersonalUsageMetrics } from "../../../../lib/usage";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ authenticated: false }, { status: 503 });
  const actor = getRequestActor(request);
  if (!actor) return Response.json({ authenticated: false }, { headers: { "cache-control": "no-store" } });
  try {
    return Response.json({ authenticated: true, ...(await getPersonalUsageMetrics(runtimeEnv.DB, actor.id)) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "사용 통계를 불러오지 못했습니다." }, { status: 500 });
  }
}
