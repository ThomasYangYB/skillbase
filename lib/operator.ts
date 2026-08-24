import { runtimeEnv } from "./runtime-env";

export type Operator = { id: string; email: string | null };

export function getOperator(request: Request): Operator | null {
  const configuredId = runtimeEnv.SKILLBASE_OPERATOR_USER_ID;
  const userId = request.headers.get("oai-authenticated-user-id");
  if (!configuredId || !userId || userId !== configuredId) return null;
  return {
    id: userId,
    email: request.headers.get("oai-authenticated-user-email"),
  };
}
