import { runtimeEnv } from "./runtime-env";

export type Operator = { id: string; email: string | null };

export function getOperator(request: Request): Operator | null {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if ((origin && origin !== new URL(request.url).origin) || fetchSite === "cross-site") return null;
  const configuredId = runtimeEnv.SKILLBASE_OPERATOR_USER_ID;
  const configuredEmail = runtimeEnv.SKILLBASE_OPERATOR_EMAIL?.toLowerCase();
  const allowEmail = runtimeEnv.SKILLBASE_OPERATOR_ALLOW_EMAIL === "true";
  const userId = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email")?.toLowerCase() ?? null;
  const idMatches = Boolean(configuredId && userId && userId === configuredId);
  const emailMatches = allowEmail && Boolean(configuredEmail && email && email === configuredEmail);
  if (!idMatches && !emailMatches) return null;
  return {
    id: userId ?? configuredId ?? configuredEmail ?? "operator",
    email,
  };
}

export function operatorErrorResponse() {
  if (!runtimeEnv.SKILLBASE_OPERATOR_USER_ID && !runtimeEnv.SKILLBASE_OPERATOR_EMAIL) {
    return Response.json({ error: "운영자 계정이 아직 설정되지 않았습니다." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  return Response.json({ error: "운영자 권한이 필요합니다." }, { status: 401, headers: { "cache-control": "no-store" } });
}
