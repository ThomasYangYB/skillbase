import { getRequestActor } from "../../../../lib/user";
import { ensureWorkspaceSchema, getWorkspaceDetails, inviteWorkspaceMember, removeWorkspaceMember } from "../../../../lib/workspaces";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  const actor = getRequestActor(request);
  if (!actor) return Response.json({ error: "로그인이 필요한 기능입니다." }, { status: 401 });
  const workspaceId = new URL(request.url).searchParams.get("workspaceId")?.trim() ?? "";
  if (!workspaceId) return Response.json({ error: "workspaceId가 필요합니다." }, { status: 400 });
  try {
    await ensureWorkspaceSchema(runtimeEnv.DB);
    const details = await getWorkspaceDetails(runtimeEnv.DB, workspaceId, actor);
    return Response.json({ members: details.members, role: details.role }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "멤버를 불러오지 못했습니다." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  const actor = getRequestActor(request);
  if (!actor) return Response.json({ error: "로그인이 필요한 기능입니다." }, { status: 401 });
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return Response.json({ error: "JSON 요청만 허용됩니다." }, { status: 415 });
  try {
    const body = await request.json() as { workspaceId?: unknown; email?: unknown; role?: unknown };
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().slice(0, 254) : "";
    const role = body.role === "editor" ? "editor" : "viewer";
    if (!workspaceId || !email || !/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "유효한 초대 이메일을 입력하세요." }, { status: 400 });
    await ensureWorkspaceSchema(runtimeEnv.DB);
    const result = await inviteWorkspaceMember(runtimeEnv.DB, workspaceId, actor, email, role);
    const origin = new URL(request.url).origin;
    return Response.json({ ...result, inviteUrl: origin + "/workspaces?invite=" + encodeURIComponent(result.token) }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "멤버 초대에 실패했습니다." }, { status: 409 });
  }
}

export async function DELETE(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  const actor = getRequestActor(request);
  if (!actor) return Response.json({ error: "로그인이 필요한 기능입니다." }, { status: 401 });
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId")?.trim() ?? "";
  const memberId = url.searchParams.get("memberId")?.trim() ?? "";
  if (!workspaceId || !memberId) return Response.json({ error: "workspaceId와 memberId가 필요합니다." }, { status: 400 });
  try {
    await ensureWorkspaceSchema(runtimeEnv.DB);
    return Response.json(await removeWorkspaceMember(runtimeEnv.DB, workspaceId, actor, memberId));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "멤버를 삭제하지 못했습니다." }, { status: 409 });
  }
}
