import { env as cloudflareEnv } from "cloudflare:workers";

export type RuntimeEnv = {
  DB?: D1Database;
  GITHUB_TOKEN?: string;
  SKILLBASE_SYNC_TOKEN?: string;
  SKILLBASE_OPERATOR_USER_ID?: string;
};

export const runtimeEnv = cloudflareEnv as unknown as RuntimeEnv;
