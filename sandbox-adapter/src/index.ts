import { ContainerProxy, getSandbox, Sandbox as CloudflareSandbox } from "@cloudflare/sandbox";
import { DurableObject } from "cloudflare:workers";
import { buildInstallCommand, parseInstallCommand, parseVerifyRequest, rawSourceUrl, safeSandboxId, SKILLS_CLI_VERSION, sourceRepository, trimOutput, type VerifyRequest } from "./policy";

export { ContainerProxy };

type Env = {
  Sandbox: DurableObjectNamespace<Sandbox>;
  RESULTS: DurableObjectNamespace<VerificationResultStore>;
  SANDBOX_ADAPTER_TOKEN?: string;
  SKILLBASE_CALLBACK_TOKEN?: string;
  SKILLBASE_CALLBACK_URL: string;
  VERIFICATION_QUEUE: Queue<VerifyRequest>;
};

type StoredVerificationResult = {
  jobId: string;
  sourceHash: string;
  status: "passed" | "failed";
  verificationMethod?: "official_cli" | "integrity_fallback";
  summary: string;
  findings: unknown[];
  durationMs?: number;
  completedAt: string;
};

export class Sandbox extends CloudflareSandbox {
  enableInternet = false;
  allowedHosts = [
    "github.com",
    "*.github.com",
    "raw.githubusercontent.com",
    "api.github.com",
    "codeload.github.com",
    "objects.githubusercontent.com",
    "registry.npmjs.org",
    "npmjs.org",
    "*.npmjs.org",
    "npmjs.com",
    "*.npmjs.com",
    "www.npmjs.com",
    "skills.sh",
    "*.skills.sh",
    "add-skill.vercel.sh",
  ];
}

export class VerificationResultStore extends DurableObject {
  async fetch(request: Request) {
    if (request.method === "PUT") {
      const result = await request.json() as StoredVerificationResult;
      await this.ctx.storage.put("result", result);
      return Response.json({ ok: true });
    }
    if (request.method === "GET") {
      const result = await this.ctx.storage.get<StoredVerificationResult>("result");
      return result ? Response.json(result) : Response.json({ status: "queued" });
    }
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
}

function unauthorized() {
  return Response.json({ error: "Sandbox 어댑터 인증이 필요합니다." }, { status: 401 });
}

function callbackAllowed(request: VerifyRequest, env: Env) {
  return !request.callbackUrl || request.callbackUrl === env.SKILLBASE_CALLBACK_URL;
}

async function notifyCatalog(request: VerifyRequest, env: Env, status: "passed" | "failed", verificationMethod: "official_cli" | "integrity_fallback" | undefined, summary: string, findings: unknown[]) {
  if (!request.callbackUrl || !env.SKILLBASE_CALLBACK_TOKEN) return null;
  const response = await fetch(request.callbackUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.SKILLBASE_CALLBACK_TOKEN}`,
    },
      body: JSON.stringify({ jobId: request.jobId, sourceHash: request.sourceHash, status, ...(verificationMethod ? { verificationMethod } : {}), summary, findings }),
  });
  console.log(JSON.stringify({ event: "verification-callback", jobId: safeSandboxId(request.jobId), status: response.status }));
  if (!response.ok) throw new Error(`카탈로그 callback이 ${response.status}로 실패했습니다.`);
  return response;
}

async function storeResult(request: VerifyRequest, env: Env, result: Omit<StoredVerificationResult, "jobId" | "sourceHash" | "completedAt">) {
  const id = env.RESULTS.idFromName(safeSandboxId(request.jobId));
  const response = await env.RESULTS.get(id).fetch("https://skillbase-result/store", {
    method: "PUT",
    body: JSON.stringify({ ...result, jobId: request.jobId, sourceHash: request.sourceHash, completedAt: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(`검증 결과 저장이 ${response.status}로 실패했습니다.`);
}

async function notifyCatalogBestEffort(request: VerifyRequest, env: Env, status: "passed" | "failed", verificationMethod: "official_cli" | "integrity_fallback" | undefined, summary: string, findings: unknown[]) {
  try {
    await notifyCatalog(request, env, status, verificationMethod, summary, findings);
  } catch (error) {
    console.log(JSON.stringify({ event: "verification-callback-skipped", jobId: safeSandboxId(request.jobId), reason: error instanceof Error ? error.message : "callback failed" }));
  }
}

async function verify(request: VerifyRequest, env: Env) {
  const startedAt = Date.now();
  const parsed = parseInstallCommand(request.install);
  const source = sourceRepository(request.sourceUrl);
  if (!parsed || !source) throw new Error("설치 명령 또는 출처 형식이 허용 목록과 일치하지 않습니다.");
  const sandbox = getSandbox(env.Sandbox, safeSandboxId(request.jobId), {
    enableDefaultSession: false,
    sleepAfter: "30s",
    containerTimeouts: { instanceGetTimeoutMS: 90000, portReadyTimeoutMS: 120000 },
  });
  const command = buildInstallCommand(parsed);
  try {
    let primary: Awaited<ReturnType<typeof sandbox.exec>> | null = null;
    let primaryError: string | null = null;
    try {
      primary = await sandbox.exec(command, { cwd: "/workspace", timeout: Math.min(request.constraints.timeoutMs, 90000) });
    } catch (error) {
      primaryError = error instanceof Error ? error.message : "공식 CLI 실행이 중단되었습니다.";
    }
    let result = primary;
    const usedFallback = !primary?.success;
    if (usedFallback) {
      const rawUrl = rawSourceUrl(request.sourceUrl);
      if (!rawUrl) throw new Error("원본 SKILL.md를 위한 안전한 raw URL을 만들 수 없습니다.");
      const rawResponse = await fetch(rawUrl, { headers: { accept: "text/plain", "user-agent": "skillbase-sandbox-adapter/1.0" } });
      if (!rawResponse.ok) throw new Error(`원본 SKILL.md를 ${rawResponse.status}로 가져오지 못했습니다.`);
      const raw = await rawResponse.text();
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
      const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      if (hash !== request.sourceHash.toLowerCase()) throw new Error("원본 SKILL.md 해시가 카탈로그 해시와 일치하지 않습니다.");
      const installPath = `/workspace/.agents/skills/${parsed.skillName}/SKILL.md`;
      await sandbox.writeFile(installPath, raw);
      result = await sandbox.exec(`test -s ${installPath}`, { cwd: "/workspace", timeout: 5000 });
    }
    if (!result) throw new Error("격리 설치 결과가 없습니다.");
    const files = await sandbox.exec("find /workspace -maxdepth 6 -type f -name SKILL.md -print 2>/dev/null", { cwd: "/workspace", timeout: 5000 });
    const output = trimOutput(`${usedFallback ? `공식 CLI 결과: ${primary ? `${primary.stdout}\n${primary.stderr}` : primaryError ?? "결과 없음"}\n보조 설치 결과: ` : ""}${result.stdout}\n${result.stderr}`);
    const installedSkill = files.stdout.split(/\r?\n/).some((path) => path.endsWith(`/${parsed.skillName}/SKILL.md`));
    const success = result.success && installedSkill;
    const summary = success
      ? usedFallback
        ? "공식 CLI가 제한 시간 안에 끝나지 않아 GitHub 저장소를 보조 경로로 격리 설치했고 SKILL.md를 확인했습니다."
        : "격리 Container에서 설치 명령이 성공했고 SKILL.md가 생성되었습니다."
      : result.success
        ? "설치 명령은 성공했지만 예상한 SKILL.md 경로를 확인하지 못했습니다."
        : `설치 명령이 실패했습니다(exit code ${result.exitCode ?? "unknown"}).`;
    const findings = [
      { code: "sandbox-install", severity: success ? usedFallback ? "warning" : "info" : "blocker", title: success ? usedFallback ? "보조 격리 설치 성공" : "격리 설치 성공" : "격리 설치 확인 실패", detail: output || summary },
      { code: "sandbox-network-policy", severity: "info", title: "네트워크 정책 적용", detail: "인터넷은 기본 차단되고 GitHub·npm·Skills 감사 메타데이터 호스트만 허용했습니다." },
    ];
    return { success, summary, findings, externalJobId: safeSandboxId(request.jobId), verificationMethod: usedFallback ? "integrity_fallback" as const : "official_cli" as const, durationMs: Date.now() - startedAt };
  } finally {
    await sandbox.destroy();
  }
}

async function processVerification(request: VerifyRequest, env: Env) {
  const startedAt = Date.now();
  let result: Awaited<ReturnType<typeof verify>>;
  try {
    result = await verify(request, env);
  } catch (error) {
    const summary = error instanceof Error ? error.message : "격리 설치 검증에 실패했습니다.";
    const findings = [{ code: "sandbox-error", severity: "blocker", title: "격리 검증 실행 오류", detail: summary }];
    await storeResult(request, env, { status: "failed", summary, findings, durationMs: Date.now() - startedAt });
    await notifyCatalogBestEffort(request, env, "failed", undefined, summary, findings);
    return;
  }
  console.log(JSON.stringify({ event: "verification-result", jobId: safeSandboxId(request.jobId), success: result.success, method: result.verificationMethod }));
  await storeResult(request, env, { status: result.success ? "passed" : "failed", verificationMethod: result.success ? result.verificationMethod : undefined, summary: result.summary, findings: result.findings, durationMs: result.durationMs });
  await notifyCatalogBestEffort(request, env, result.success ? "passed" : "failed", result.success ? result.verificationMethod : undefined, result.summary, result.findings);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") return Response.json({ ok: true, service: "skillbase-sandbox-adapter", asyncVerification: true, skillsCliVersion: SKILLS_CLI_VERSION });
    if (url.pathname !== "/verify" && url.pathname !== "/result") return Response.json({ error: "Not found" }, { status: 404 });
    if (!env.SANDBOX_ADAPTER_TOKEN) return Response.json({ error: "Sandbox adapter secret이 설정되지 않았습니다." }, { status: 503 });
    if (!env.VERIFICATION_QUEUE) return Response.json({ error: "검증 Queue가 설정되지 않았습니다." }, { status: 503 });
    if (request.headers.get("authorization") !== `Bearer ${env.SANDBOX_ADAPTER_TOKEN}`) return unauthorized();
    if (url.pathname === "/result" && request.method === "GET") {
      const jobId = url.searchParams.get("jobId") ?? "";
      if (!/^[A-Za-z0-9:_./-]{1,240}$/.test(jobId)) return Response.json({ error: "jobId가 필요합니다." }, { status: 400 });
      const id = env.RESULTS.idFromName(safeSandboxId(jobId));
      return env.RESULTS.get(id).fetch("https://skillbase-result/result");
    }
    if (url.pathname !== "/verify" || request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
    try {
      const raw = await request.text();
      if (raw.length > 32000) return Response.json({ error: "요청 본문이 너무 큽니다." }, { status: 413 });
      const body = JSON.parse(raw) as unknown;
      const parsed = parseVerifyRequest(body);
      if (!parsed) return Response.json({ error: "허용되지 않은 검증 요청 형식입니다." }, { status: 400 });
      if (!callbackAllowed(parsed, env)) return Response.json({ error: "허용되지 않은 callback URL입니다." }, { status: 400 });
      await env.VERIFICATION_QUEUE.send(parsed);
      return Response.json({ externalJobId: safeSandboxId(parsed.jobId), status: "queued", summary: "공식 CLI 검증 작업을 Queue에 등록했습니다." }, { status: 202 });
    } catch (error) {
      const summary = error instanceof Error ? error.message : "격리 설치 검증에 실패했습니다.";
      return Response.json({ status: "failed", summary }, { status: 503 });
    }
  },
  async queue(batch: MessageBatch<VerifyRequest>, env: Env) {
    console.log(JSON.stringify({ event: "verification-queue-received", messageCount: batch.messages.length }));
    for (const message of batch.messages) {
      try {
        console.log(JSON.stringify({ event: "verification-queue-start", jobId: safeSandboxId(message.body.jobId) }));
        await processVerification(message.body, env);
        message.ack();
        console.log(JSON.stringify({ event: "verification-queue-ack", jobId: safeSandboxId(message.body.jobId) }));
      } catch {
        console.log(JSON.stringify({ event: "verification-queue-retry", jobId: safeSandboxId(message.body.jobId) }));
        message.retry();
      }
    }
  },
};
