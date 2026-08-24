import { getStoredSkillRecord, type VerificationStatus } from "./sync";

export type VerificationMode = "static" | "sandbox";
export type VerificationJobStatus = "queued" | "running" | "passed" | "warning" | "blocked" | "failed" | "unavailable";
export type VerificationFinding = {
  code: string;
  severity: "blocker" | "warning" | "info";
  title: string;
  detail: string;
};

export type VerificationEnv = {
  DB?: D1Database;
  GITHUB_TOKEN?: string;
  SKILLBASE_SANDBOX_URL?: string;
  SKILLBASE_SANDBOX_TOKEN?: string;
};

const VERIFIER_VERSION = "static-1";

function now() {
  return new Date().toISOString();
}

function rawSourceUrl(sourceUrl: string) {
  const match = sourceUrl.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}`;
}

function parseFrontmatter(raw: string) {
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
  if (!match) return { name: "", description: "", body: raw };
  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([a-zA-Z][\w-]*):\s*(.*)$/);
    if (field) fields[field[1]] = field[2].replace(/^['"]|['"]$/g, "").trim();
  }
  return { name: fields.name ?? "", description: fields.description ?? "", body: raw.slice(match[0].length) };
}

function addFinding(findings: VerificationFinding[], finding: VerificationFinding) {
  if (!findings.some((item) => item.code === finding.code)) findings.push(finding);
}

function scanDocument(raw: string, sourceUrl: string, expectedName: string) {
  const findings: VerificationFinding[] = [];
  const parsed = parseFrontmatter(raw);
  const sourcePath = sourceUrl.split("/blob/")[1]?.split("/") ?? [];
  const parentDirectory = sourcePath.at(-2) ?? "";

  if (!parsed.name || !parsed.description) {
    addFinding(findings, { code: "invalid-frontmatter", severity: "blocker", title: "필수 frontmatter 누락", detail: "name과 description이 모두 있어야 합니다." });
  } else if (parsed.name !== expectedName || parsed.name !== parentDirectory || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parsed.name)) {
    addFinding(findings, { code: "invalid-name", severity: "blocker", title: "Skill 이름 규칙 위반", detail: "Agent Skills 표준의 name·디렉터리 규칙을 통과하지 못했습니다." });
  }

  const body = parsed.body;
  const blockers: Array<[RegExp, string, string]> = [
    [/\b(?:curl|wget)\b[^\n|]*(?:\|\s*(?:sh|bash)|\|\s*sudo)/i, "remote-shell", "원격 응답을 셸로 바로 넘기는 패턴이 있습니다."],
    [/\bsudo\b|\bchmod\s+777\b|\brm\s+-rf\s+\//i, "privileged-destructive", "권한 상승 또는 광범위한 삭제 명령이 있습니다."],
    [/\bpowershell(?:\.exe)?\b[^\n]*-(?:enc|encodedcommand)\b/i, "encoded-powershell", "인코딩된 PowerShell 실행 패턴이 있습니다."],
    [/\bbase64\s+(?:-d|--decode)\b[^\n|]*\|\s*(?:sh|bash)/i, "decoded-shell", "디코딩한 내용을 셸로 실행하는 패턴이 있습니다."],
    [/(?:cat|read)\s+[^\n]*(?:~\/\.ssh|~\/\.aws|id_rsa|credentials)/i, "credential-file-read", "로컬 자격증명 파일을 읽으려는 패턴이 있습니다."],
    [/(?:process\.env\.[A-Z0-9_]*(?:KEY|TOKEN|SECRET)|os\.environ\[[^\]]*(?:KEY|TOKEN|SECRET))/i, "secret-access", "환경변수의 비밀값에 접근하는 패턴이 있습니다."],
  ];
  for (const [pattern, code, detail] of blockers) {
    if (pattern.test(body)) addFinding(findings, { code, severity: "blocker", title: "자동 실행 차단 신호", detail });
  }

  const warnings: Array<[RegExp, string, string]> = [
    [/^allowed-tools\s*:/im, "declared-tools", "허용 도구 목록이 선언되어 있어 운영자 확인이 필요합니다."],
    [/\bscripts?\//i, "bundled-script", "부속 스크립트 실행 가능성이 있습니다."],
    [/\b(?:npm|pnpm|yarn|pip|apt-get)\s+(?:install|add)\b/i, "package-install", "외부 패키지 설치가 필요할 수 있습니다."],
    [/\b(?:npx|node|python|bash|sh)\b/i, "process-execution", "프로세스 실행 지시가 포함되어 있을 수 있습니다."],
    [/(?:\bfetch\s*\(|\b(?:curl|wget)\b|https?:\/\/)/i, "network-access", "외부 네트워크 접근 가능성이 있습니다."],
    [/(?:child_process|subprocess|os\.system|eval\s*\()/i, "runtime-execution", "런타임 명령 실행 API가 언급됩니다."],
  ];
  for (const [pattern, code, detail] of warnings) {
    if (pattern.test(body)) addFinding(findings, { code, severity: "warning", title: "추가 검토 신호", detail });
  }

  if (findings.length === 0) addFinding(findings, { code: "no-suspicious-signals", severity: "info", title: "차단 신호 없음", detail: "SKILL.md를 실행하지 않고 정적 패턴만 검사했습니다." });
  const hasBlocker = findings.some((finding) => finding.severity === "blocker");
  const hasWarning = findings.some((finding) => finding.severity === "warning");
  const status: VerificationStatus = hasBlocker ? "static_blocked" : hasWarning ? "static_warning" : "static_passed";
  const jobStatus: VerificationJobStatus = hasBlocker ? "blocked" : hasWarning ? "warning" : "passed";
  const summary = hasBlocker
    ? "자동 실행을 차단해야 하는 신호가 발견되었습니다. 공개 전에 운영자 확인이 필요합니다."
    : hasWarning
      ? "차단 신호는 없지만 실행·네트워크 관련 신호가 있어 격리 검증이 필요합니다."
      : "차단 신호 없이 정적 검사를 통과했습니다. 실제 설치 실행은 하지 않았습니다.";
  return { status, jobStatus, summary, findings, contentBytes: new TextEncoder().encode(raw).byteLength };
}

async function fetchDocument(sourceUrl: string, env: VerificationEnv) {
  const url = rawSourceUrl(sourceUrl);
  if (!url) throw new Error("GitHub raw 파일로 변환할 수 없는 출처입니다.");
  const headers = new Headers({ accept: "text/plain", "user-agent": "skillbase-static-verifier/1.0" });
  if (env.GITHUB_TOKEN && url.includes("raw.githubusercontent.com")) headers.set("authorization", `Bearer ${env.GITHUB_TOKEN}`);
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} from ${url}`);
  return response.text();
}

function envDatabase(env: VerificationEnv) {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

export async function runStaticVerification(env: VerificationEnv, skillId: string, actor: { id: string; email?: string | null }) {
  const db = envDatabase(env);
  const skill = await getStoredSkillRecord(db, skillId);
  if (!skill) throw new Error("Skill을 찾을 수 없습니다.");
  const createdAt = now();
  const jobId = crypto.randomUUID();
  const sourceHash = String(skill.content_hash);
  await db.prepare("INSERT INTO skill_verification_jobs (id, skill_id, mode, status, requested_by, requested_email, source_hash, verifier_version, created_at, started_at) VALUES (?, ?, 'static', 'running', ?, ?, ?, ?, ?, ?)").bind(jobId, skillId, actor.id, actor.email ?? null, sourceHash, VERIFIER_VERSION, createdAt, createdAt).run();
  try {
    const raw = await fetchDocument(String(skill.source_url), env);
    const scan = scanDocument(raw, String(skill.source_url), String(skill.name));
    const finishedAt = now();
    await db.batch([
      db.prepare("UPDATE skill_verification_jobs SET status = ?, summary = ?, findings_json = ?, finished_at = ? WHERE id = ?").bind(scan.jobStatus, scan.summary, JSON.stringify(scan.findings), finishedAt, jobId),
      db.prepare("UPDATE skills SET verification_status = ?, verification_updated_at = ?, verification_summary = ? WHERE id = ? AND content_hash = ?").bind(scan.status, finishedAt, scan.summary, skillId, sourceHash),
    ]);
    return { jobId, mode: "static" as const, status: scan.status, jobStatus: scan.jobStatus, summary: scan.summary, findings: scan.findings, contentBytes: scan.contentBytes };
  } catch (error) {
    const finishedAt = now();
    const summary = error instanceof Error ? error.message : "정적 검증에 실패했습니다.";
    await db.prepare("UPDATE skill_verification_jobs SET status = 'failed', summary = ?, finished_at = ? WHERE id = ?").bind(summary, finishedAt, jobId).run();
    throw new Error(summary);
  }
}

export async function requestSandboxVerification(env: VerificationEnv, skillId: string, actor: { id: string; email?: string | null }, callbackUrl?: string) {
  const db = envDatabase(env);
  const skill = await getStoredSkillRecord(db, skillId);
  if (!skill) throw new Error("Skill을 찾을 수 없습니다.");
  const createdAt = now();
  const jobId = crypto.randomUUID();
  const sourceHash = String(skill.content_hash);
  await db.prepare("INSERT INTO skill_verification_jobs (id, skill_id, mode, status, requested_by, requested_email, source_hash, verifier_version, created_at) VALUES (?, ?, 'sandbox', 'queued', ?, ?, ?, 'sandbox-adapter-1', ?)").bind(jobId, skillId, actor.id, actor.email ?? null, sourceHash, createdAt).run();
  if (!env.SKILLBASE_SANDBOX_URL) {
    const summary = "Cloudflare Sandbox 어댑터가 연결되지 않았습니다. 정적 검사 결과만 사용하세요.";
    await db.prepare("UPDATE skill_verification_jobs SET status = 'unavailable', summary = ?, finished_at = ? WHERE id = ?").bind(summary, now(), jobId).run();
    return { jobId, mode: "sandbox" as const, status: "sandbox_unavailable" as const, jobStatus: "unavailable" as const, summary, findings: [] as VerificationFinding[] };
  }

  try {
    const headers = new Headers({ "content-type": "application/json", "user-agent": "skillbase-sandbox-adapter/1.0" });
    if (env.SKILLBASE_SANDBOX_TOKEN) headers.set("authorization", `Bearer ${env.SKILLBASE_SANDBOX_TOKEN}`);
    const response = await fetch(env.SKILLBASE_SANDBOX_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ jobId, skillId, sourceUrl: String(skill.source_url), sourceHash, install: String(skill.install), callbackUrl, constraints: { network: "deny-by-default", timeoutMs: 30000, filesystem: "ephemeral", secrets: "none" } }),
    });
    const payload = await response.json().catch(() => ({})) as { externalJobId?: string; status?: string; summary?: string };
    if (!response.ok) throw new Error(payload.summary ?? `Sandbox adapter returned ${response.status}`);
    const passed = payload.status === "passed";
    const summary = payload.summary ?? (passed ? "격리 환경 설치 검증을 통과했습니다." : "외부 Sandbox에서 검증 대기 중입니다.");
    await db.batch([
      db.prepare("UPDATE skill_verification_jobs SET status = ?, external_job_id = ?, summary = ?, finished_at = ? WHERE id = ?").bind(passed ? "passed" : "queued", payload.externalJobId ?? null, summary, passed ? now() : null, jobId),
      ...(passed ? [db.prepare("UPDATE skills SET verification_status = 'sandbox_passed', verification_updated_at = ?, verification_summary = ? WHERE id = ? AND content_hash = ?").bind(now(), summary, skillId, sourceHash)] : []),
    ]);
    return { jobId, mode: "sandbox" as const, status: passed ? "sandbox_passed" as const : "unverified" as const, jobStatus: passed ? "passed" as const : "queued" as const, summary, findings: [] as VerificationFinding[] };
  } catch (error) {
    const summary = error instanceof Error ? error.message : "Sandbox 어댑터 요청에 실패했습니다.";
    await db.prepare("UPDATE skill_verification_jobs SET status = 'failed', summary = ?, finished_at = ? WHERE id = ?").bind(summary, now(), jobId).run();
    throw new Error(summary);
  }
}

export async function listVerificationJobs(db: D1Database, skillId: string, limit = 20) {
  await getStoredSkillRecord(db, skillId);
  const rows = await db.prepare("SELECT id, skill_id, mode, status, verifier_version, summary, findings_json, external_job_id, created_at, started_at, finished_at FROM skill_verification_jobs WHERE skill_id = ? ORDER BY created_at DESC LIMIT ?").bind(skillId, Math.min(Math.max(limit, 1), 50)).all<Record<string, unknown>>();
  return (rows.results ?? []).map((row) => ({
    id: String(row.id),
    skillId: String(row.skill_id),
    mode: String(row.mode),
    status: String(row.status),
    verifierVersion: String(row.verifier_version),
    summary: row.summary ? String(row.summary) : null,
    findings: (() => { try { const parsed = JSON.parse(String(row.findings_json ?? "[]")); return Array.isArray(parsed) ? parsed : []; } catch { return []; } })(),
    externalJobId: row.external_job_id ? String(row.external_job_id) : null,
    createdAt: String(row.created_at),
    startedAt: row.started_at ? String(row.started_at) : null,
    finishedAt: row.finished_at ? String(row.finished_at) : null,
  }));
}
