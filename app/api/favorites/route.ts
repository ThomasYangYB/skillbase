import { getRequestActor } from "../../../lib/user";
import { listFavoriteIds, setFavorite } from "../../../lib/usage";
import { runtimeEnv } from "../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ ids: [] }, { status: 503 });
  const actor = getRequestActor(request);
  if (!actor) return Response.json({ ids: [], authenticated: false }, { headers: { "cache-control": "no-store" } });
  try {
    return Response.json({ ids: await listFavoriteIds(runtimeEnv.DB, actor.id), authenticated: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "즐겨찾기를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  const actor = getRequestActor(request);
  if (!actor) return Response.json({ error: "로그인이 필요한 기능입니다." }, { status: 401 });
  try {
    const body = await request.json() as { skillId?: string; active?: boolean };
    if (!body.skillId || body.skillId.length > 240 || typeof body.active !== "boolean") return Response.json({ error: "skillId와 active가 필요합니다." }, { status: 400 });
    return Response.json({ active: await setFavorite(runtimeEnv.DB, body.skillId, actor.id, body.active) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "즐겨찾기를 변경하지 못했습니다." }, { status: 400 });
  }
}
