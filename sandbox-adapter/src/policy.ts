export type VerifyRequest = {
  jobId: string;
  skillId: string;
  sourceUrl: string;
  sourceHash: string;
  install: string;
  callbackUrl?: string;
  constraints: {
    network: "deny-by-default";
    timeoutMs: number;
    filesystem: "ephemeral";
    secrets: "none";
  };
};

export type ParsedInstall = {
  repo: string;
  skillName: string;
};

export const SKILLS_CLI_VERSION = "1.5.23";

const safeIdPattern = /^[A-Za-z0-9:_./-]{1,240}$/;
const skillNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hashPattern = /^[a-f0-9]{64}$/i;
const repoPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function stringValue(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength ? value : null;
}

export function parseInstallCommand(install: string): ParsedInstall | null {
  const match = install.trim().match(/^npx\s+skills\s+add\s+https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\s+--skill\s+([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (!match || !repoPattern.test(match[1]) || !skillNamePattern.test(match[2])) return null;
  return { repo: match[1], skillName: match[2] };
}

export function sourceRepository(sourceUrl: string) {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "github.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 5 || parts[2] !== "blob" || parts.at(-1)?.toLowerCase() !== "skill.md") return null;
  const skillName = parts.at(-2) ?? "";
  if (!repoPattern.test(`${parts[0]}/${parts[1]}`) || !skillNamePattern.test(skillName)) return null;
  return { repo: `${parts[0]}/${parts[1]}`, skillName };
}

export function parseVerifyRequest(value: unknown): VerifyRequest | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const jobId = stringValue(body.jobId, 240);
  const skillId = stringValue(body.skillId, 240);
  const sourceUrl = stringValue(body.sourceUrl, 500);
  const sourceHash = stringValue(body.sourceHash, 128);
  const install = stringValue(body.install, 500);
  const callbackUrl = typeof body.callbackUrl === "string" ? body.callbackUrl : undefined;
  const constraints = body.constraints;
  if (!jobId || !safeIdPattern.test(jobId) || !skillId || !safeIdPattern.test(skillId) || !sourceUrl || !sourceHash || !hashPattern.test(sourceHash) || !install || !constraints || typeof constraints !== "object") return null;
  const constraintRecord = constraints as Record<string, unknown>;
  const timeoutMs = Number(constraintRecord.timeoutMs);
  if (constraintRecord.network !== "deny-by-default" || constraintRecord.filesystem !== "ephemeral" || constraintRecord.secrets !== "none" || !Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 90000) return null;
  const source = sourceRepository(sourceUrl);
  const parsedInstall = parseInstallCommand(install);
  if (!source || !parsedInstall || source.repo.toLowerCase() !== parsedInstall.repo.toLowerCase() || source.skillName !== parsedInstall.skillName) return null;
  return { jobId, skillId, sourceUrl, sourceHash, install, callbackUrl, constraints: { network: "deny-by-default", timeoutMs, filesystem: "ephemeral", secrets: "none" } };
}

export function buildInstallCommand(parsed: ParsedInstall) {
  return `DO_NOT_TRACK=1 NPM_CONFIG_AUDIT=false NPM_CONFIG_FUND=false PATH=/opt/skillbase-cli/node_modules/.bin:$PATH npx --offline --no-install skills add https://github.com/${parsed.repo} --skill ${parsed.skillName} --agent codex --yes --copy`;
}

export function rawSourceUrl(sourceUrl: string) {
  const match = sourceUrl.match(/^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/blob\/([A-Za-z0-9._/-]+)$/);
  if (!match || !match[2].toLowerCase().endsWith("/skill.md")) return null;
  return `https://raw.githubusercontent.com/${match[1]}/${match[2]}`;
}

export function safeSandboxId(jobId: string) {
  return `skillbase-${jobId.replace(/[^A-Za-z0-9-]/g, "-").slice(0, 180)}`;
}

export function trimOutput(value: string, limit = 1200) {
  const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "g");
  const clean = value.replace(ansiPattern, "").trim();
  return clean.length <= limit ? clean : `${clean.slice(-limit)}…`;
}
