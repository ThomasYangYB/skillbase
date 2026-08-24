/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { recordOpsAlerts } from "../lib/alerts";
import { processPendingSkillSummaries, syncAllSources, type SummaryAiBinding } from "../lib/sync";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  GITHUB_TOKEN?: string;
  SKILLBASE_SYNC_TOKEN?: string;
  SKILLBASE_OPERATOR_USER_ID?: string;
  SKILLBASE_OPERATOR_EMAIL?: string;
  SKILLBASE_OPERATOR_ALLOW_EMAIL?: string;
  SKILLBASE_SANDBOX_URL?: string;
  SKILLBASE_SANDBOX_TOKEN?: string;
  SKILLBASE_ALERT_WEBHOOK_URL?: string;
  AI?: SummaryAiBinding;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface ScheduledController {
  cron: string;
  scheduledTime: number;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);
    const secured = new Response(response.body, response);
    secured.headers.set("x-content-type-options", "nosniff");
    secured.headers.set("referrer-policy", "strict-origin-when-cross-origin");
    secured.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
    secured.headers.set("x-frame-options", "DENY");
    secured.headers.set("x-permitted-cross-domain-policies", "none");
    secured.headers.set("cross-origin-opener-policy", "same-origin");
    if (url.protocol === "https:") secured.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
    return secured;
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      await syncAllSources(env);
      await processPendingSkillSummaries(env);
    })().catch(async (error) => {
      console.error(`Scheduled skill sync failed for ${controller.cron}`, error);
      await recordOpsAlerts(env, [{ kind: "sync_failure", severity: "critical", title: "예약 수집 작업 중단", message: error instanceof Error ? error.message : "예약 수집 작업이 중단되었습니다.", fingerprint: "sync:scheduled-exception" }]);
    }));
  },
};

export default worker;
