import { listStoredSkills } from "../../../../lib/sync";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

function clean(value: string | null, max = 80) {
  return (value ?? "").trim().slice(0, max);
}

function headers() {
  return {
    "access-control-allow-origin": "*",
    "cache-control": "public, max-age=60, stale-while-revalidate=300",
    "content-type": "application/json; charset=utf-8",
  };
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...headers(), "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type" } });
}

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503, headers: headers() });
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50) || 50, 1), 100);
  const skills = await listStoredSkills(
    runtimeEnv.DB,
    clean(url.searchParams.get("q")),
    clean(url.searchParams.get("region"), 10),
    clean(url.searchParams.get("category")),
    clean(url.searchParams.get("verification"), 40),
    clean(url.searchParams.get("sort"), 20) || "recommended",
    limit,
    clean(url.searchParams.get("platform"), 40),
  );
  return Response.json({ data: skills, meta: { count: skills.length, limit, generatedAt: new Date().toISOString() } }, { headers: headers() });
}
