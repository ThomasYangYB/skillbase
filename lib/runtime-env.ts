import { env as cloudflareEnv } from "cloudflare:workers";
import type { SummaryAiBinding } from "./sync";

export type RuntimeEnv = {
  DB?: D1Database;
  GITHUB_TOKEN?: string;
  SKILLBASE_SYNC_TOKEN?: string;
  SKILLBASE_OPERATOR_USER_ID?: string;
  SKILLBASE_OPERATOR_EMAIL?: string;
  SKILLBASE_OPERATOR_ALLOW_EMAIL?: string;
  SKILLBASE_SANDBOX_URL?: string;
  SKILLBASE_SANDBOX_TOKEN?: string;
  SKILLBASE_ALERT_WEBHOOK_URL?: string;
  AI?: SummaryAiBinding;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_API_BASE_URL?: string;
};

export const runtimeEnv = cloudflareEnv as unknown as RuntimeEnv;
