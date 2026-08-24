import { env as cloudflareEnv } from "cloudflare:workers";

export type RuntimeEnv = {
  DB?: D1Database;
  GITHUB_TOKEN?: string;
  SKILLBASE_SYNC_TOKEN?: string;
};

export const runtimeEnv = cloudflareEnv as unknown as RuntimeEnv;
