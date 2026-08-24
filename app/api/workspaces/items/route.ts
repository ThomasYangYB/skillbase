import { getRequestActor } from "../../../../lib/user";
import { addWorkspaceSkill, ensureWorkspaceSchema, removeWorkspaceSkill } from "../../../../lib/workspaces";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  const actor = getRequestActor(request);
  if (!actor) return Response.json({ error: "로그인이 필요한 기능입니다." }, { status: 401 });
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return Response.json({ error: "JSON 요청만 허용됩니다." }, { status: 415 });
  try {
    const body = await request.json() as { workspaceId?: unknown; skillId?: unknown; note?: unknown };
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
    const skillId = typeof body.skillId === "string" ? body.skillId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;
    if (!workspaceId || workspaceId.length > 160 || !skillId || skillId.length > 500) return Response.json({ error: "workspaceId와 skillId가 필요합니다." }, { status: 400 });
    await ensureWorkspaceSchema(runtimeEnv.DB);
    return Response.json(await addWorkspaceSkill(runtimeEnv.DB, workspaceId, actor, skillId, note), { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "비공개 공간에 Skill을 추가하지 못했습니다." }, { status: 409 });
  }
}

export async function DELETE(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  const actor = getRequestActor(request);
  if (!actor) return Response.json({ error: "로그인이 필요한 기능입니다." }, { status: 401 });
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId")?.trim() ?? "";
  const skillId = url.searchParams.get("skillId")?.trim() ?? "";
  if (!workspaceId || !skillId) return Response.json({ error: "workspaceId와 skillId가 필요합니다." }, { status: 400 });
  try {
    await ensureWorkspaceSchema(runtimeEnv.DB);
    return Response.json(await removeWorkspaceSkill(runtimeEnv.DB, workspaceId, actor, skillId));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "비공개 공간에서 Skill을 삭제하지 못했습니다." }, { status: 409 });
  }
}
