import { ContainerProxy, getSandbox, Sandbox as CloudflareSandbox } from "@cloudflare/sandbox";
import { buildInstallCommand, parseInstallCommand, parseVerifyRequest, safeSandboxId, sourceRepository, trimOutput, type VerifyRequest } from "./policy";

export { ContainerProxy };

type Env = {
  Sandbox: DurableObjectNamespace<Sandbox>;
  SANDBOX_ADAPTER_TOKEN?: string;
  SKILLBASE_CALLBACK_TOKEN?: string;
  SKILLBASE_CALLBACK_URL: string;
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
    "www.npmjs.com",
  ];
}

function unauthorized() {
  return Response.json({ error: "Sandbox 어댑터 인증이 필요합니다." }, { status: 401 });
}

function callbackAllowed(request: VerifyRequest, env: Env) {
  return !request.callbackUrl || request.callbackUrl === env.SKILLBASE_CALLBACK_URL;
}

async function notifyCatalog(request: VerifyRequest, env: Env, status: "passed" | "failed", summary: string, findings: unknown[]) {
  if (!request.callbackUrl || !env.SKILLBASE_CALLBACK_TOKEN) return null;
  const response = await fetch(request.callbackUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.SKILLBASE_CALLBACK_TOKEN}`,
    },
    body: JSON.stringify({ jobId: request.jobId, sourceHash: request.sourceHash, status, summary, findings }),
  });
  if (!response.ok) throw new Error(`카탈로그 callback이 ${response.status}로 실패했습니다.`);
  return response;
}

async function verify(request: VerifyRequest, env: Env) {
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
    const result = await sandbox.exec(command, { cwd: "/workspace", timeout: request.constraints.timeoutMs });
    const files = await sandbox.exec("find /workspace -maxdepth 6 -type f -name SKILL.md -print 2>/dev/null", { cwd: "/workspace", timeout: 5000 });
    const output = trimOutput(`${result.stdout}\n${result.stderr}`);
    const installedSkill = files.stdout.split(/\r?\n/).some((path) => path.endsWith(`/${parsed.skillName}/SKILL.md`));
    const success = result.success && installedSkill;
    const summary = success
      ? "격리 Container에서 설치 명령이 성공했고 SKILL.md가 생성되었습니다."
      : result.success
        ? "설치 명령은 성공했지만 예상한 SKILL.md 경로를 확인하지 못했습니다."
        : `설치 명령이 실패했습니다(exit code ${result.exitCode ?? "unknown"}).`;
    const findings = [
      { code: "sandbox-install", severity: success ? "info" : "blocker", title: success ? "격리 설치 성공" : "격리 설치 확인 실패", detail: output || summary },
      { code: "sandbox-network-policy", severity: "info", title: "네트워크 정책 적용", detail: "인터넷은 기본 차단되고 GitHub·npm 허용 목록만 열려 있었습니다." },
    ];
    return { success, summary, findings, externalJobId: safeSandboxId(request.jobId) };
  } finally {
    await sandbox.destroy();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") return Response.json({ ok: true, service: "skillbase-sandbox-adapter" });
    if (url.pathname !== "/verify" || request.method !== "POST") return Response.json({ error: "Not found" }, { status: 404 });
    if (!env.SANDBOX_ADAPTER_TOKEN) return Response.json({ error: "Sandbox adapter secret이 설정되지 않았습니다." }, { status: 503 });
    if (request.headers.get("authorization") !== `Bearer ${env.SANDBOX_ADAPTER_TOKEN}`) return unauthorized();
    try {
      const raw = await request.text();
      if (raw.length > 32000) return Response.json({ error: "요청 본문이 너무 큽니다." }, { status: 413 });
      const body = JSON.parse(raw) as unknown;
      const parsed = parseVerifyRequest(body);
      if (!parsed) return Response.json({ error: "허용되지 않은 검증 요청 형식입니다." }, { status: 400 });
      if (!callbackAllowed(parsed, env)) return Response.json({ error: "허용되지 않은 callback URL입니다." }, { status: 400 });
      const result = await verify(parsed, env);
      const status = result.success ? "passed" : "failed";
      let callbackWarning: string | undefined;
      try {
        await notifyCatalog(parsed, env, status, result.summary, result.findings);
      } catch (callbackError) {
        callbackWarning = callbackError instanceof Error ? callbackError.message : "카탈로그 callback을 완료하지 못했습니다.";
      }
      return Response.json({ externalJobId: result.externalJobId, status, summary: result.summary, findings: result.findings, callbackWarning });
    } catch (error) {
      const summary = error instanceof Error ? error.message : "격리 설치 검증에 실패했습니다.";
      return Response.json({ status: "failed", summary }, { status: 502 });
    }
  },
};
