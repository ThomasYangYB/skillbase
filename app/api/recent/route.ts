import { getRequestActor } from "../../../lib/user";
import { listRecentSkillIds } from "../../../lib/usage";
import { runtimeEnv } from "../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ ids: [], authenticated: false }, { status: 503 });
  const actor = getRequestActor(request);
  if (!actor) return Response.json({ ids: [], authenticated: false }, { headers: { "cache-control": "no-store" } });
  try {
    return Response.json({ ids: await listRecentSkillIds(runtimeEnv.DB, actor.id), authenticated: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "최근 본 Skill을 불러오지 못했습니다." }, { status: 500 });
  }
}
