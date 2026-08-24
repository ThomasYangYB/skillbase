import { runtimeEnv } from "./runtime-env";

export type Operator = { id: string; email: string | null };

export function getOperator(request: Request): Operator | null {
  const configuredId = runtimeEnv.SKILLBASE_OPERATOR_USER_ID;
  const configuredEmail = runtimeEnv.SKILLBASE_OPERATOR_EMAIL?.toLowerCase();
  const userId = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email")?.toLowerCase() ?? null;
  const idMatches = Boolean(configuredId && userId && userId === configuredId);
  const emailMatches = Boolean(configuredEmail && email && email === configuredEmail);
  if (!idMatches && !emailMatches) return null;
  return {
    id: userId ?? configuredId ?? configuredEmail ?? "operator",
    email,
  };
}
