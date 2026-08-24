import { getRequestActor } from "../../../lib/user";
import { createWorkspace, ensureWorkspaceSchema, listWorkspaces } from "../../../lib/workspaces";
import { runtimeEnv } from "../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  const actor = getRequestActor(request);
  if (!actor) return Response.json({ workspaces: [], authenticated: false }, { headers: { "cache-control": "no-store" } });
  try {
    return Response.json({ workspaces: await listWorkspaces(runtimeEnv.DB, actor), authenticated: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "비공개 공간을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  const actor = getRequestActor(request);
  if (!actor) return Response.json({ error: "로그인이 필요한 기능입니다." }, { status: 401 });
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return Response.json({ error: "JSON 요청만 허용됩니다." }, { status: 415 });
  try {
    await ensureWorkspaceSchema(runtimeEnv.DB);
    const body = await request.json() as { name?: unknown };
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    if (name.length < 2) return Response.json({ error: "공간 이름을 2자 이상 입력하세요." }, { status: 400 });
    return Response.json({ workspace: await createWorkspace(runtimeEnv.DB, actor, name) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "비공개 공간을 만들지 못했습니다." }, { status: 400 });
  }
}
