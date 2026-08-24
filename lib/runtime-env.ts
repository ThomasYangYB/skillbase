import { env as cloudflareEnv } from "cloudflare:workers";

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
};

export const runtimeEnv = cloudflareEnv as unknown as RuntimeEnv;
