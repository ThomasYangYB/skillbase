import { getRequestActor } from "../../../../lib/user";
import { acceptWorkspaceInvite, ensureWorkspaceSchema } from "../../../../lib/workspaces";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  const actor = getRequestActor(request);
  if (!actor) return Response.json({ error: "초대를 수락하려면 로그인이 필요합니다." }, { status: 401 });
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return Response.json({ error: "JSON 요청만 허용됩니다." }, { status: 415 });
  try {
    const body = await request.json() as { token?: unknown };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!/^[a-f0-9]{48}$/.test(token)) return Response.json({ error: "초대 토큰 형식이 올바르지 않습니다." }, { status: 400 });
    await ensureWorkspaceSchema(runtimeEnv.DB);
    return Response.json(await acceptWorkspaceInvite(runtimeEnv.DB, actor, token));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "초대를 수락하지 못했습니다." }, { status: 409 });
  }
}
