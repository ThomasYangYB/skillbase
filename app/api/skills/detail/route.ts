import { getPublishedSkill } from "../../../../lib/sync";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id || id.length > 500) return Response.json({ error: "유효한 Skill ID가 필요합니다." }, { status: 400 });
  const skill = await getPublishedSkill(runtimeEnv.DB, id);
  if (!skill) return Response.json({ error: "공개된 Skill을 찾을 수 없습니다." }, { status: 404 });
  return Response.json({ skill }, { headers: { "cache-control": "no-store" } });
}
