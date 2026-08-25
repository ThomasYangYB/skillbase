import { createBetaAccessRequest, isValidBetaEmail, normalizeBetaEmail } from "../../../../lib/beta";
import { enforceD1RateLimit, rateLimitHeaders, requestNetworkIdentity } from "../../../../lib/rate-limit";
import { runtimeEnv } from "../../../../lib/runtime-env";
import { getRequestActor } from "../../../../lib/user";

export const dynamic = "force-dynamic";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return Response.json({ error: "JSON 요청만 허용됩니다." }, { status: 415 });
  const raw = await request.text();
  if (raw.length > 3000) return Response.json({ error: "신청 내용이 너무 깁니다." }, { status: 413 });
  try {
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (text(body.website, 120)) return Response.json({ ok: true }, { status: 202 });
    const email = normalizeBetaEmail(text(body.email, 254));
    const note = text(body.note, 600) || null;
    if (!isValidBetaEmail(email)) return Response.json({ error: "유효한 이메일 주소를 입력하세요." }, { status: 400 });
    if (body.consent !== true) return Response.json({ error: "베타 운영 안내와 개인정보 수집에 동의해야 합니다." }, { status: 400 });
    const actor = getRequestActor(request);
    const identity = actor?.id ?? await requestNetworkIdentity(request);
    const limit = await enforceD1RateLimit(runtimeEnv.DB, "beta_access", identity, 3, 86400);
    if (!limit.allowed) return Response.json({ error: "베타 신청은 하루에 3건까지 가능합니다." }, { status: 429, headers: rateLimitHeaders(limit) });
    const result = await createBetaAccessRequest(runtimeEnv.DB, email, note, actor?.id ?? null);
    return Response.json({ ok: true, status: result.status, duplicate: result.duplicate, message: result.duplicate ? "이미 접수되었거나 초대 검토 중인 이메일입니다." : "베타 신청이 접수되었습니다. 운영자 검토 후 안내합니다." }, { status: result.duplicate ? 200 : 201, headers: rateLimitHeaders(limit) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "베타 신청에 실패했습니다." }, { status: 400 });
  }
}
