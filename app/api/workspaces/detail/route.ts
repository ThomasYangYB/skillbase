import { getRequestActor } from "../../../../lib/user";
import { ensureWorkspaceSchema, getWorkspaceDetails } from "../../../../lib/workspaces";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  const actor = getRequestActor(request);
  if (!actor) return Response.json({ error: "로그인이 필요한 기능입니다." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id || id.length > 160) return Response.json({ error: "workspace id가 필요합니다." }, { status: 400 });
  try {
    await ensureWorkspaceSchema(runtimeEnv.DB);
    return Response.json({ workspace: await getWorkspaceDetails(runtimeEnv.DB, id, actor) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "비공개 공간을 불러오지 못했습니다." }, { status: 403 });
  }
}
