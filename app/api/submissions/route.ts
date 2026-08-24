import { getRequestActor } from "../../../lib/user";
import { runtimeEnv } from "../../../lib/runtime-env";

export const dynamic = "force-dynamic";

async function actorKey(request: Request) {
  const actor = getRequestActor(request);
  if (actor) return { id: actor.id, email: actor.email };
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const agent = request.headers.get("user-agent") ?? "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}|${agent}`));
  return { id: `anon:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32)}`, email: null };
}

function value(input: unknown, max: number) {
  return typeof input === "string" ? input.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return Response.json({ error: "JSON 요청만 허용됩니다." }, { status: 415 });
  const raw = await request.text();
  if (raw.length > 9000) return Response.json({ error: "제출 내용이 너무 깁니다." }, { status: 413 });
  try {
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (value(body.website, 120)) return Response.json({ ok: true }, { status: 202 });
    const name = value(body.name, 100);
    const sourceUrl = value(body.sourceUrl, 500);
    const sourceType = value(body.sourceType, 20);
    const category = value(body.category, 60);
    const description = value(body.description, 1200);
    const install = value(body.install, 500);
    const prompt = value(body.prompt, 4000);
    if (name.length < 2 || description.length < 10 || install.length < 1 || prompt.length < 10 || !category) return Response.json({ error: "이름·카테고리·설명·설치 명령어·프롬프트를 입력하세요." }, { status: 400 });
    if (!['공식', '커뮤니티', '디렉터리'].includes(sourceType)) return Response.json({ error: "출처 유형이 올바르지 않습니다." }, { status: 400 });
    let parsedUrl: URL;
    try { parsedUrl = new URL(sourceUrl); } catch { return Response.json({ error: "원본 URL 형식이 올바르지 않습니다." }, { status: 400 }); }
    if (parsedUrl.protocol !== "https:") return Response.json({ error: "HTTPS 원본 URL만 등록할 수 있습니다." }, { status: 400 });
    const actor = await actorKey(request);
    const recent = await runtimeEnv.DB.prepare("SELECT COUNT(*) AS count FROM skill_submissions WHERE actor_id = ? AND created_at >= datetime('now', '-1 day')").bind(actor.id).first<{ count: number }>();
    if (Number(recent?.count ?? 0) >= 3) return Response.json({ error: "제출은 하루에 3건까지 가능합니다." }, { status: 429, headers: { "retry-after": "86400" } });
    const duplicate = await runtimeEnv.DB.prepare("SELECT id FROM skill_submissions WHERE actor_id = ? AND source_url = ? AND status = 'pending' LIMIT 1").bind(actor.id, sourceUrl).first<{ id: string }>();
    if (duplicate) return Response.json({ error: "같은 원본이 이미 검토 대기 중입니다." }, { status: 409 });
    await runtimeEnv.DB.prepare("INSERT INTO skill_submissions (id, actor_id, actor_email, name, source_url, source_type, category, description, install, prompt, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)").bind(crypto.randomUUID(), actor.id, actor.email, name, sourceUrl, sourceType, category, description, install, prompt, new Date().toISOString()).run();
    return Response.json({ ok: true, status: "pending", message: "제출이 접수되었습니다. 운영자 검토 후 카탈로그에 등록됩니다." }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Skill 제출에 실패했습니다." }, { status: 400 });
  }
}
