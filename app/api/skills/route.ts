import { runtimeEnv } from "../../../lib/runtime-env";
import { listStoredSkills } from "../../../lib/sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ skills: [], source: "fallback", message: "D1 is not configured" }, { status: 503 });

  const url = new URL(request.url);
  const skills = await listStoredSkills(
    runtimeEnv.DB,
    url.searchParams.get("q")?.trim() ?? "",
    url.searchParams.get("region")?.trim() ?? "",
    url.searchParams.get("category")?.trim() ?? "",
    url.searchParams.get("verification")?.trim() ?? "",
    url.searchParams.get("sort")?.trim() ?? "recommended",
    Number(url.searchParams.get("limit") ?? 120),
    url.searchParams.get("platform")?.trim() ?? "",
  );
  return Response.json({ skills, source: "d1", collectedAt: new Date().toISOString() }, {
    headers: { "cache-control": "no-store" },
  });
}
