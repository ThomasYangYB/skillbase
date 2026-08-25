import { recordOpsAlerts } from "./alerts";
import { runQualityChecks } from "./quality";

type SourceKind = "github" | "skills-sh" | "directory";
type Region = "국내" | "해외";
type SourceType = "공식" | "커뮤니티" | "디렉터리";

export type ApprovalStatus = "review" | "approved" | "rejected" | "published";
export type ReviewAction = "approve" | "publish" | "reject" | "review" | "unpublish";
export type VerificationStatus = "unverified" | "legacy" | "static_passed" | "static_warning" | "static_blocked" | "sandbox_passed" | "sandbox_fallback_passed" | "sandbox_failed" | "sandbox_unavailable";

export type SummaryAiBinding = {
  run(model: string, input: { messages: Array<{ role: "system" | "user"; content: string }> }): Promise<unknown>;
};

export type SyncEnv = {
  DB?: D1Database;
  GITHUB_TOKEN?: string;
  SKILLBASE_ALERT_WEBHOOK_URL?: string;
  AI?: SummaryAiBinding;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_API_BASE_URL?: string;
};

export type CatalogSkill = {
  id: string;
  name: string;
  category: string;
  description: string;
  summaryKo?: string | null;
  summaryStatus?: "pending" | "generated" | "failed";
  summaryUpdatedAt?: string | null;
  summaryError?: string | null;
  summaryReviewStatus?: "pending" | "approved" | "needs_revision";
  summaryReviewedBy?: string | null;
  summaryReviewedAt?: string | null;
  tags: string[];
  compatibility: string[];
  risk: "낮음" | "주의";
  region: Region;
  source: string;
  sourceUrl: string;
  sourceType: SourceType;
  trust: "원본 확인" | "검토 필요";
  prompt: string;
  install: string;
  appUrl: string;
  license?: string | null;
  contentHash: string;
  discoveredVia: string;
  sourceUpdatedAt?: string | null;
  approvalStatus?: ApprovalStatus;
  verificationStatus?: VerificationStatus;
  usageCount?: number;
  favoriteCount?: number;
  qualityIssueCount?: number;
};

type SyncSource = {
  id: string;
  name: string;
  kind: SourceKind;
  url: string;
  region: Region;
  sourceType: SourceType;
  repo?: string;
  branch?: string;
};

type GitTreeItem = { path: string; type: string };
type ParsedSkill = {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  body: string;
};

type CollectedSource = {
  candidates: CatalogSkill[];
  seen: number;
  rejected: number;
  errors: string[];
};

const MAX_SKILLS_PER_REPOSITORY = 80;
const MAX_DIRECTORY_REPOSITORIES = 12;
const MAX_SKILLS_SH_REPOSITORIES = 24;

export const SYNC_SOURCES: SyncSource[] = [
  {
    id: "github-anthropic-skills",
    name: "Anthropic / skills",
    kind: "github",
    repo: "anthropics/skills",
    branch: "main",
    url: "https://github.com/anthropics/skills",
    region: "해외",
    sourceType: "공식",
  },
  {
    id: "github-vercel-agent-skills",
    name: "Vercel Labs / agent-skills",
    kind: "github",
    repo: "vercel-labs/agent-skills",
    branch: "main",
    url: "https://github.com/vercel-labs/agent-skills",
    region: "해외",
    sourceType: "공식",
  },
  {
    id: "github-cloudflare-skills",
    name: "Cloudflare / skills",
    kind: "github",
    repo: "cloudflare/skills",
    branch: "main",
    url: "https://github.com/cloudflare/skills",
    region: "해외",
    sourceType: "공식",
  },
  {
    id: "github-mattpocock-skills",
    name: "Matt Pocock / skills",
    kind: "github",
    repo: "mattpocock/skills",
    branch: "main",
    url: "https://github.com/mattpocock/skills",
    region: "해외",
    sourceType: "커뮤니티",
  },
  {
    id: "github-korean-skills",
    name: "DaleSeo/korean-skills",
    kind: "github",
    repo: "DaleSeo/korean-skills",
    branch: "main",
    url: "https://github.com/DaleSeo/korean-skills",
    region: "국내",
    sourceType: "커뮤니티",
  },
  {
    id: "github-im-not-ai",
    name: "epoko77-ai/im-not-ai",
    kind: "github",
    repo: "epoko77-ai/im-not-ai",
    branch: "main",
    url: "https://github.com/epoko77-ai/im-not-ai",
    region: "국내",
    sourceType: "커뮤니티",
  },
  {
    id: "skills-sh-leaderboard",
    name: "skills.sh leaderboard",
    kind: "skills-sh",
    url: "https://www.skills.sh/",
    region: "해외",
    sourceType: "디렉터리",
  },
  {
    id: "directory-claude-korea",
    name: "Claude Korea",
    kind: "directory",
    url: "https://claudekorea.com/",
    region: "국내",
    sourceType: "디렉터리",
  },
  {
    id: "directory-awesome-claude-code",
    name: "subinium/awesome-claude-code",
    kind: "directory",
    repo: "subinium/awesome-claude-code",
    branch: "main",
    url: "https://github.com/subinium/awesome-claude-code",
    region: "국내",
    sourceType: "디렉터리",
  },
];

function now() {
  return new Date().toISOString();
}

function trimText(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function unquote(value: string) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatter(raw: string): ParsedSkill | null {
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  if (!match) return null;

  const fields: Record<string, string> = {};
  const lines = match[1].split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const field = lines[index].match(/^([a-zA-Z][\w-]*):\s*(.*)$/);
    if (!field) continue;
    const [, key, rawValue] = field;
    if (rawValue === "|" || rawValue === ">" || rawValue === "|-" || rawValue === ">-") {
      const block: string[] = [];
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        index += 1;
        block.push(lines[index].trim());
      }
      fields[key] = block.join(rawValue.startsWith(">") ? " " : "\n");
    } else {
      fields[key] = unquote(rawValue);
    }
  }

  if (!fields.name || !fields.description) return null;
  return {
    name: fields.name,
    description: trimText(fields.description, 1024),
    license: fields.license,
    compatibility: fields.compatibility,
    body: match[2],
  };
}

function validSkillName(name: string, parentDirectory: string) {
  return Boolean(
    name &&
      name === parentDirectory &&
      name.length <= 64 &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) &&
      !name.includes("--")
  );
}

function parseJsonArray(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function extractTags(name: string, description: string, category: string) {
  const haystack = `${name} ${description}`.toLowerCase();
  const tags = new Set<string>();
  const rules: Array<[RegExp, string]> = [
    [/react|next\.js|frontend|typescript|javascript|code|개발|코드/, "개발"],
    [/pdf|docx|pptx|xlsx|document|문서|word|spreadsheet/, "문서"],
    [/design|ui|ux|figma|frontend|디자인/, "디자인"],
    [/test|tdd|review|테스트|리뷰/, "품질"],
    [/agent|mcp|worker|cloudflare|automation|에이전트|자동화/, "에이전트"],
    [/korean|한국어|grammar|humanize|style|맞춤법|문체/, "한국어"],
  ];
  for (const [pattern, label] of rules) if (pattern.test(haystack)) tags.add(label);
  tags.add(category);
  return [...tags].slice(0, 4);
}

function inferCategory(name: string, description: string) {
  const haystack = `${name} ${description}`.toLowerCase();
  if (/korean|한국어|grammar|humanize|style-guide|맞춤법|문체/.test(haystack)) return "한국어·문서";
  if (/pdf|docx|pptx|xlsx|document|word|spreadsheet|문서/.test(haystack)) return "문서·사무";
  if (/design|ui|ux|figma|frontend-design|web-design/.test(haystack)) return "디자인·크리에이티브";
  if (/research|data|analytics|market|리서치|데이터/.test(haystack)) return "리서치·데이터";
  if (/marketing|content|seo|writing|콘텐츠|마케팅/.test(haystack)) return "콘텐츠·마케팅";
  if (/automation|agent|workflow|mcp|worker|자동화|에이전트/.test(haystack)) return "업무 자동화";
  return "개발·IT";
}

function inferRisk(body: string, treePaths: string[]) {
  const haystack = `${body}\n${treePaths.join(" ")}`;
  return /allowed-tools|scripts\/|secret|credential|token|network|curl|wget|npm install|npx |fetch\(/i.test(haystack) ? "주의" : "낮음";
}

function appUrlFor(compatibility: string[]) {
  const text = compatibility.join(" ").toLowerCase();
  if (text.includes("claude")) return "https://claude.ai/";
  if (text.includes("gemini")) return "https://gemini.google.com/";
  return "https://chatgpt.com/";
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchText(url: string, env: SyncEnv, accept = "text/plain") {
  const headers = new Headers({
    accept,
    "user-agent": "skillbase-sync/1.0 (+https://skillbase-ai-skills.syjd2025.chatgpt.site)",
  });
  if (env.GITHUB_TOKEN && url.includes("api.github.com")) headers.set("authorization", `Bearer ${env.GITHUB_TOKEN}`);
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} from ${url}`);
  return response.text();
}

async function fetchJson<T>(url: string, env: SyncEnv): Promise<T> {
  return JSON.parse(await fetchText(url, env, "application/vnd.github+json")) as T;
}

function repoUrl(repo: string) {
  return `https://github.com/${repo}`;
}

function rawUrl(repo: string, branch: string, path: string) {
  return `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
}

function githubSkillUrl(repo: string, branch: string, path: string) {
  return `${repoUrl(repo)}/blob/${branch}/${path}`;
}

function guessRegion(repo: string, fallback: Region): Region {
  return /^(DaleSeo|epoko77-ai|subinium|claudekorea)\//i.test(repo) ? "국내" : fallback === "국내" ? "해외" : fallback;
}

async function skillFromFile(
  source: SyncSource,
  repo: string,
  branch: string,
  path: string,
  raw: string,
  treePaths: string[],
  discoveredVia = source.name,
): Promise<CatalogSkill | null> {
  const parsed = parseFrontmatter(raw);
  const parentDirectory = path.split("/").at(-2) ?? "";
  if (!parsed || !validSkillName(parsed.name, parentDirectory) || !parsed.description) return null;

  const category = inferCategory(parsed.name, parsed.description);
  const compatibility = parsed.compatibility
    ? parsed.compatibility.split(/[,;/]+/).map((value) => value.trim()).filter(Boolean).slice(0, 5)
    : ["Agent Skills"];
  const region = source.region;
  const id = `${source.id}:${repo}:${parsed.name}`.toLowerCase();
  return {
    id,
    name: parsed.name,
    category,
    description: parsed.description,
    tags: extractTags(parsed.name, parsed.description, category),
    compatibility,
    risk: inferRisk(parsed.body, treePaths),
    region,
    source: source.name,
    sourceUrl: githubSkillUrl(repo, branch, path),
    sourceType: source.sourceType,
    trust: source.sourceType === "공식" ? "원본 확인" : "검토 필요",
    prompt: `다음 작업을 ${parsed.name} Skill의 지침에 맞춰 수행해라. 사실과 추정을 구분하고, 입력이 부족하면 먼저 질문해라.\n\n작업:\n{{input}}\n\nSkill 설명:\n${parsed.description}`,
    install: `npx skills add ${repoUrl(repo)} --skill ${parsed.name}`,
    appUrl: appUrlFor(compatibility),
    license: parsed.license ?? null,
    contentHash: await sha256(raw),
    discoveredVia,
  };
}

async function collectGithubRepo(source: SyncSource, env: SyncEnv, onlyNames?: Set<string>, discoveredVia = source.name): Promise<CollectedSource> {
  const candidates: CatalogSkill[] = [];
  const errors: string[] = [];
  if (!source.repo) return { candidates, seen: 0, rejected: 0, errors: ["GitHub repository is missing"] };

  try {
    const branch = source.branch ?? (await fetchJson<{ default_branch: string }>(`https://api.github.com/repos/${source.repo}`, env)).default_branch;
    const tree = await fetchJson<{ tree?: GitTreeItem[] }>(`https://api.github.com/repos/${source.repo}/git/trees/${branch}?recursive=1`, env);
    const skillFiles = (tree.tree ?? [])
      .filter((item) => item.type === "blob" && item.path.toLowerCase().endsWith("/skill.md"))
      .filter((item) => !onlyNames || onlyNames.has(item.path.split("/").at(-2) ?? ""))
      .slice(0, MAX_SKILLS_PER_REPOSITORY);
    const treePaths = (tree.tree ?? []).map((item) => item.path);
    for (const item of skillFiles) {
      try {
        const raw = await fetchText(rawUrl(source.repo, branch, item.path), env);
        const skill = await skillFromFile(source, source.repo, branch, item.path, raw, treePaths, discoveredVia);
        if (skill) candidates.push(skill);
      } catch (error) {
        errors.push(`${item.path}: ${error instanceof Error ? error.message : "unknown error"}`);
      }
    }
    return { candidates, seen: skillFiles.length, rejected: skillFiles.length - candidates.length, errors };
  } catch (error) {
    return { candidates, seen: 0, rejected: 0, errors: [error instanceof Error ? error.message : "unknown error"] };
  }
}

function extractSkillShLinks(html: string) {
  const links = new Map<string, { repo: string; name: string; pageUrl: string }>();
  const matches = html.matchAll(/href=["']\/(?!api\/)([^"'/?]+\/[^"'/?]+\/[^"'#?]+)["']/g);
  for (const match of matches) {
    const path = match[1].split("/").map((part) => part.trim()).filter(Boolean);
    if (path.length !== 3 || path.some((part) => part === "packs" || part === "topics" || part === "official") || path[0] === "site" || path[0].includes(".")) continue;
    const [owner, repo, name] = path;
    links.set(`${owner}/${repo}:${name}`, { repo: `${owner}/${repo}`, name, pageUrl: `https://www.skills.sh/${path.join("/")}` });
  }
  return [...links.values()].slice(0, MAX_SKILLS_SH_REPOSITORIES);
}

async function collectSkillsSh(source: SyncSource, env: SyncEnv): Promise<CollectedSource> {
  try {
    const html = await fetchText(source.url, env, "text/html");
    const links = extractSkillShLinks(html);
    const grouped = new Map<string, Set<string>>();
    for (const link of links) grouped.set(link.repo, new Set([...(grouped.get(link.repo) ?? []), link.name]));
    const results: CollectedSource = { candidates: [], seen: links.length, rejected: 0, errors: [] };
    for (const [repo, names] of grouped) {
      const linkedSource: SyncSource = {
        ...source,
        id: `skills-sh:${repo}`,
        name: `skills.sh / ${repo}`,
        url: `https://www.skills.sh/${repo}`,
        repo,
      };
      const result = await collectGithubRepo(linkedSource, env, names, "skills.sh leaderboard");
      results.candidates.push(...result.candidates);
      results.rejected += result.rejected;
      results.errors.push(...result.errors);
    }
    return results;
  } catch (error) {
    return { candidates: [], seen: 0, rejected: 0, errors: [error instanceof Error ? error.message : "unknown error"] };
  }
}

function extractGithubRepos(text: string) {
  const repos = new Set<string>();
  for (const match of text.matchAll(/https?:\/\/github\.com\/([\w.-]+\/[\w.-]+)/g)) {
    repos.add(match[1].replace(/[),.;].*$/, ""));
  }
  return [...repos].filter((repo) => repo.split("/").length === 2).slice(0, MAX_DIRECTORY_REPOSITORIES);
}

async function collectDirectory(source: SyncSource, env: SyncEnv): Promise<CollectedSource> {
  try {
    const text = source.repo
      ? await fetchText(rawUrl(source.repo, source.branch ?? "main", "README.md"), env)
      : await fetchText(source.url, env, "text/html");
    const repos = extractGithubRepos(text).filter((repo) => repo.toLowerCase() !== source.repo?.toLowerCase());
    const results: CollectedSource = { candidates: [], seen: repos.length, rejected: 0, errors: [] };
    for (const repo of repos) {
      const linkedSource: SyncSource = {
        ...source,
        id: `${source.id}:${repo}`,
        name: repo,
        url: repoUrl(repo),
        repo,
        region: guessRegion(repo, source.region),
      };
      const result = await collectGithubRepo(linkedSource, env, undefined, source.name);
      results.candidates.push(...result.candidates);
      results.rejected += result.rejected;
      results.errors.push(...result.errors);
    }
    return results;
  } catch (error) {
    return { candidates: [], seen: 0, rejected: 0, errors: [error instanceof Error ? error.message : "unknown error"] };
  }
}

async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS skills (id TEXT PRIMARY KEY, source_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, summary_ko TEXT, summary_status TEXT NOT NULL DEFAULT 'pending', summary_updated_at TEXT, summary_error TEXT, summary_review_status TEXT NOT NULL DEFAULT 'pending', summary_reviewed_by TEXT, summary_reviewed_at TEXT, category TEXT NOT NULL, region TEXT NOT NULL, source TEXT NOT NULL, source_url TEXT NOT NULL, source_type TEXT NOT NULL, compatibility_json TEXT NOT NULL DEFAULT '[]', tags_json TEXT NOT NULL DEFAULT '[]', install TEXT NOT NULL, prompt TEXT NOT NULL, app_url TEXT NOT NULL, risk TEXT NOT NULL, trust TEXT NOT NULL, license TEXT, license_previous TEXT, license_changed_at TEXT, content_hash TEXT NOT NULL, discovered_via TEXT NOT NULL, source_updated_at TEXT, last_seen_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', approval_status TEXT NOT NULL DEFAULT 'review', approval_updated_at TEXT, approved_by TEXT, published_at TEXT, verification_status TEXT NOT NULL DEFAULT 'unverified', verification_updated_at TEXT, verification_summary TEXT, source_link_status TEXT NOT NULL DEFAULT 'unknown', source_link_checked_at TEXT, source_link_error TEXT, duplicate_of TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS sync_sources (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, url TEXT NOT NULL, region TEXT NOT NULL, source_type TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, last_synced_at TEXT, last_error TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS sync_runs (id TEXT PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL, sources_scanned INTEGER NOT NULL DEFAULT 0, candidates_seen INTEGER NOT NULL DEFAULT 0, accepted INTEGER NOT NULL DEFAULT 0, rejected INTEGER NOT NULL DEFAULT 0, error_summary TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS skill_feedback (id TEXT PRIMARY KEY, skill_id TEXT NOT NULL, type TEXT NOT NULL, message TEXT, actor_id TEXT, created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS ops_alerts (id TEXT PRIMARY KEY, kind TEXT NOT NULL, severity TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, fingerprint TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, resolved_at TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS skill_quality_issues (id TEXT PRIMARY KEY, skill_id TEXT NOT NULL, kind TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', message TEXT NOT NULL, details_json TEXT NOT NULL DEFAULT '{}', checked_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS skill_usage_events (id TEXT PRIMARY KEY, skill_id TEXT NOT NULL, event_type TEXT NOT NULL, actor_id TEXT, created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS skill_favorites (id TEXT PRIMARY KEY, skill_id TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS skill_submissions (id TEXT PRIMARY KEY, actor_id TEXT, actor_email TEXT, name TEXT NOT NULL, source_url TEXT NOT NULL, source_type TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, install TEXT NOT NULL, prompt TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', reviewer_id TEXT, review_note TEXT, created_at TEXT NOT NULL, reviewed_at TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS beta_access_requests (id TEXT PRIMARY KEY, email TEXT NOT NULL, note TEXT, actor_id TEXT, status TEXT NOT NULL DEFAULT 'pending', consented_at TEXT NOT NULL, created_at TEXT NOT NULL, reviewed_by TEXT, reviewed_at TEXT, review_note TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS request_rate_limits (key TEXT NOT NULL, window_start INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY (key, window_start))"),
    db.prepare("CREATE TABLE IF NOT EXISTS skill_workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id TEXT NOT NULL, owner_email TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS skill_workspace_members (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, actor_id TEXT, actor_email TEXT, role TEXT NOT NULL DEFAULT 'viewer', status TEXT NOT NULL DEFAULT 'invited', invite_token_hash TEXT, invite_expires_at TEXT, joined_at TEXT, created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS skill_workspace_items (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, skill_id TEXT NOT NULL, note TEXT, added_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS skill_review_events (id TEXT PRIMARY KEY, skill_id TEXT NOT NULL, action TEXT NOT NULL, from_status TEXT, to_status TEXT NOT NULL, actor_id TEXT NOT NULL, actor_email TEXT, note TEXT, created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS skill_verification_jobs (id TEXT PRIMARY KEY, skill_id TEXT NOT NULL, mode TEXT NOT NULL, status TEXT NOT NULL, requested_by TEXT NOT NULL, requested_email TEXT, source_hash TEXT NOT NULL, verifier_version TEXT NOT NULL, summary TEXT, findings_json TEXT NOT NULL DEFAULT '[]', verification_method TEXT, duration_ms INTEGER, external_job_id TEXT, created_at TEXT NOT NULL, started_at TEXT, finished_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skills_status_category ON skills(status, category)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skills_region ON skills(region)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skills_last_seen ON skills(last_seen_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_review_events_skill ON skill_review_events(skill_id, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_feedback_skill ON skill_feedback(skill_id, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_ops_alerts_status_created ON ops_alerts(status, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_ops_alerts_fingerprint ON ops_alerts(fingerprint, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_quality_skill_kind ON skill_quality_issues(skill_id, kind)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_quality_status ON skill_quality_issues(status, severity)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_usage_skill_event ON skill_usage_events(skill_id, event_type, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_usage_actor ON skill_usage_events(actor_id, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_favorites_skill_actor ON skill_favorites(skill_id, actor_id)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_favorites_unique ON skill_favorites(skill_id, actor_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_favorites_actor ON skill_favorites(actor_id, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_submissions_status_created ON skill_submissions(status, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_submissions_actor_created ON skill_submissions(actor_id, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_beta_access_requests_status_created ON beta_access_requests(status, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_beta_access_requests_email_created ON beta_access_requests(email, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_request_rate_limits_window ON request_rate_limits(window_start)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_workspaces_owner ON skill_workspaces(owner_id, updated_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_workspace_members_workspace ON skill_workspace_members(workspace_id, status, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_workspace_members_actor ON skill_workspace_members(actor_id, status)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_workspace_members_unique_actor ON skill_workspace_members(workspace_id, actor_id) WHERE actor_id IS NOT NULL"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_workspace_items_workspace ON skill_workspace_items(workspace_id, updated_at)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_workspace_items_unique_skill ON skill_workspace_items(workspace_id, skill_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_verification_jobs_skill_status ON skill_verification_jobs(skill_id, status, created_at)"),
  ]);

  const verificationJobInfo = await db.prepare("PRAGMA table_info(skill_verification_jobs)").all<{ name: string }>();
  const verificationJobColumns = new Set((verificationJobInfo.results ?? []).map((column) => column.name));
  for (const [name, definition] of [["verification_method", "TEXT"], ["duration_ms", "INTEGER"]] as const) {
    if (verificationJobColumns.has(name)) continue;
    try {
      await db.prepare(`ALTER TABLE skill_verification_jobs ADD COLUMN ${name} ${definition}`).run();
    } catch (error) {
      if (!String(error).toLowerCase().includes("duplicate column")) throw error;
    }
  }

  const tableInfo = await db.prepare("PRAGMA table_info(skills)").all<{ name: string }>();
  const columns = new Set((tableInfo.results ?? []).map((column) => column.name));
  const legacyColumns: Array<[string, string]> = [
    ["approval_status", "TEXT NOT NULL DEFAULT 'published'"],
    ["approval_updated_at", "TEXT"],
    ["approved_by", "TEXT"],
    ["published_at", "TEXT"],
    ["verification_status", "TEXT NOT NULL DEFAULT 'legacy'"],
    ["verification_updated_at", "TEXT"],
    ["verification_summary", "TEXT"],
    ["license_previous", "TEXT"],
    ["license_changed_at", "TEXT"],
    ["source_link_status", "TEXT NOT NULL DEFAULT 'unknown'"],
    ["source_link_checked_at", "TEXT"],
    ["source_link_error", "TEXT"],
    ["duplicate_of", "TEXT"],
    ["summary_review_status", "TEXT NOT NULL DEFAULT 'pending'"],
    ["summary_reviewed_by", "TEXT"],
    ["summary_reviewed_at", "TEXT"],
  ];
  for (const [name, definition] of legacyColumns) {
    if (columns.has(name)) continue;
    try {
      await db.prepare(`ALTER TABLE skills ADD COLUMN ${name} ${definition}`).run();
    } catch (error) {
      if (!String(error).toLowerCase().includes("duplicate column")) throw error;
    }
  }
  await db.batch([
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skills_approval_status ON skills(approval_status, updated_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skills_verification_status ON skills(verification_status, updated_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_verification_jobs_method ON skill_verification_jobs(verification_method, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skills_summary_status ON skills(summary_status, updated_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skills_summary_review_status ON skills(summary_review_status, updated_at)"),
  ]);
}

async function writeSources(db: D1Database) {
  await db.batch(SYNC_SOURCES.map((source) => db.prepare("INSERT INTO sync_sources (id, name, kind, url, region, source_type) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind, url = excluded.url, region = excluded.region, source_type = excluded.source_type").bind(source.id, source.name, source.kind, source.url, source.region, source.sourceType)));
}

async function writeSkills(db: D1Database, candidates: CatalogSkill[], seenAt: string) {
  const existingHashes = new Map<string, string>();
  for (let index = 0; index < candidates.length; index += 80) {
    const chunk = candidates.slice(index, index + 80);
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => "?").join(",");
    const result = await db.prepare(`SELECT id, content_hash FROM skills WHERE id IN (${placeholders})`).bind(...chunk.map((skill) => skill.id)).all<{ id: string; content_hash: string }>();
    for (const row of result.results ?? []) existingHashes.set(String(row.id), String(row.content_hash));
  }
  const statements = candidates.map(async (skill) => {
    return db.prepare("INSERT INTO skills (id, source_id, name, description, category, region, source, source_url, source_type, compatibility_json, tags_json, install, prompt, app_url, risk, trust, license, license_previous, license_changed_at, content_hash, discovered_via, source_updated_at, last_seen_at, status, approval_status, approval_updated_at, approved_by, published_at, verification_status, verification_updated_at, verification_summary, source_link_status, source_link_checked_at, source_link_error, duplicate_of, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, 'active', 'review', ?, NULL, NULL, 'unverified', NULL, NULL, 'unknown', NULL, NULL, NULL, ?, ?) ON CONFLICT(id) DO UPDATE SET source_id = excluded.source_id, name = excluded.name, description = excluded.description, category = excluded.category, region = excluded.region, source = excluded.source, source_url = excluded.source_url, source_type = excluded.source_type, compatibility_json = excluded.compatibility_json, tags_json = excluded.tags_json, install = excluded.install, prompt = excluded.prompt, app_url = excluded.app_url, risk = excluded.risk, trust = excluded.trust, license_previous = CASE WHEN COALESCE(skills.license, '') <> COALESCE(excluded.license, '') THEN skills.license ELSE skills.license_previous END, license_changed_at = CASE WHEN COALESCE(skills.license, '') <> COALESCE(excluded.license, '') THEN excluded.updated_at ELSE skills.license_changed_at END, license = excluded.license, content_hash = excluded.content_hash, discovered_via = excluded.discovered_via, source_updated_at = excluded.source_updated_at, last_seen_at = excluded.last_seen_at, status = 'active', approval_status = CASE WHEN skills.content_hash <> excluded.content_hash THEN 'review' ELSE skills.approval_status END, approval_updated_at = CASE WHEN skills.content_hash <> excluded.content_hash THEN excluded.approval_updated_at ELSE skills.approval_updated_at END, approved_by = CASE WHEN skills.content_hash <> excluded.content_hash THEN NULL ELSE skills.approved_by END, published_at = CASE WHEN skills.content_hash <> excluded.content_hash THEN NULL ELSE skills.published_at END, verification_status = CASE WHEN skills.content_hash <> excluded.content_hash THEN 'unverified' ELSE skills.verification_status END, verification_updated_at = CASE WHEN skills.content_hash <> excluded.content_hash THEN NULL ELSE skills.verification_updated_at END, verification_summary = CASE WHEN skills.content_hash <> excluded.content_hash THEN NULL ELSE skills.verification_summary END, source_link_status = CASE WHEN skills.source_url <> excluded.source_url OR skills.content_hash <> excluded.content_hash THEN 'unknown' ELSE skills.source_link_status END, source_link_checked_at = CASE WHEN skills.source_url <> excluded.source_url OR skills.content_hash <> excluded.content_hash THEN NULL ELSE skills.source_link_checked_at END, source_link_error = CASE WHEN skills.source_url <> excluded.source_url OR skills.content_hash <> excluded.content_hash THEN NULL ELSE skills.source_link_error END, duplicate_of = CASE WHEN skills.content_hash <> excluded.content_hash THEN NULL ELSE skills.duplicate_of END, updated_at = excluded.updated_at").bind(
      skill.id,
      skill.id.split(":")[0],
      skill.name,
      skill.description,
      skill.category,
      skill.region,
      skill.source,
      skill.sourceUrl,
      skill.sourceType,
      JSON.stringify(skill.compatibility),
      JSON.stringify(skill.tags),
      skill.install,
      skill.prompt,
      skill.appUrl,
      skill.risk,
      skill.trust,
      skill.license ?? null,
      skill.contentHash,
      skill.discoveredVia,
      skill.sourceUpdatedAt ?? null,
      seenAt,
      seenAt,
      seenAt,
      seenAt,
    );
  });
  const resolved = await Promise.all(statements);
  for (let index = 0; index < resolved.length; index += 50) await db.batch(resolved.slice(index, index + 50));
  const changed = candidates.filter((skill) => existingHashes.get(skill.id) !== skill.contentHash);
  for (let index = 0; index < changed.length; index += 50) {
      await db.batch(changed.slice(index, index + 50).map((skill) => db.prepare("UPDATE skills SET summary_ko = NULL, summary_status = 'pending', summary_updated_at = NULL, summary_error = NULL, summary_review_status = 'pending', summary_reviewed_by = NULL, summary_reviewed_at = NULL WHERE id = ? AND content_hash = ?").bind(skill.id, skill.contentHash)));
  }
}

export async function syncAllSources(env: SyncEnv) {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  const db = env.DB;
  await ensureSchema(db);
  const activeRun = await db.prepare("SELECT id FROM sync_runs WHERE status = 'running' AND julianday(started_at) > julianday('now', '-45 minutes') ORDER BY started_at DESC LIMIT 1").first<{ id: string }>();
  if (activeRun) return { runId: activeRun.id, status: "already_running", sourcesScanned: 0, candidatesSeen: 0, accepted: 0, rejected: 0, errors: ["이미 실행 중인 수집 작업이 있습니다."] };
  await writeSources(db);
  const runId = crypto.randomUUID();
  const startedAt = now();
  await db.prepare("INSERT INTO sync_runs (id, started_at, status) VALUES (?, ?, 'running')").bind(runId, startedAt).run();

  let candidatesSeen = 0;
  let accepted = 0;
  let rejected = 0;
  const errors: string[] = [];
  const seenAt = now();
  for (const source of SYNC_SOURCES) {
    let result: CollectedSource;
    if (source.kind === "github") result = await collectGithubRepo(source, env);
    else if (source.kind === "skills-sh") result = await collectSkillsSh(source, env);
    else result = await collectDirectory(source, env);
    candidatesSeen += result.seen;
    rejected += result.rejected;
    errors.push(...result.errors.map((error) => `${source.name}: ${error}`));
    accepted += result.candidates.length;
    await writeSkills(db, result.candidates, seenAt);
    await db.prepare("UPDATE sync_sources SET last_synced_at = ?, last_error = ? WHERE id = ?").bind(seenAt, result.errors.length ? result.errors.slice(0, 3).join(" | ") : null, source.id).run();
  }

  if (errors.length === 0) {
    await db.prepare("UPDATE skills SET status = 'stale' WHERE last_seen_at < ? AND status = 'active'").bind(seenAt).run();
  }
  const status = errors.length ? "completed_with_errors" : "completed";
  const finishedAt = now();
  await db.prepare("UPDATE sync_runs SET finished_at = ?, status = ?, sources_scanned = ?, candidates_seen = ?, accepted = ?, rejected = ?, error_summary = ? WHERE id = ?").bind(finishedAt, status, SYNC_SOURCES.length, candidatesSeen, accepted, rejected, errors.slice(0, 20).join(" | ") || null, runId).run();
  if (errors.length > 0) {
    await recordOpsAlerts(env, [{ kind: "sync_failure", severity: "critical", title: "Skill 자동 수집 실패", message: errors.slice(0, 5).join(" | "), fingerprint: `sync:${errors.slice(0, 5).join("|").slice(0, 180)}` }]);
  }
  let quality = null;
  try {
    quality = await runQualityChecks(env);
  } catch (error) {
    await recordOpsAlerts(env, [{ kind: "quality_issue", severity: "warning", title: "Skill 품질 점검 실패", message: error instanceof Error ? error.message : "품질 점검을 완료하지 못했습니다.", fingerprint: "quality:run-failed" }]);
  }
  return { runId, status, sourcesScanned: SYNC_SOURCES.length, candidatesSeen, accepted, rejected, errors: errors.slice(0, 20), quality };
}

const SUMMARY_MODEL = "@cf/meta/llama-3.2-3b-instruct";
const SUMMARY_BATCH_SIZE = 8;
const SUMMARY_MAX_PER_RUN = 32;

type SummaryRow = { id: string; name: string; description: string; category: string; tags_json: string; content_hash: string };

function extractAiText(result: unknown) {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return "";
  const value = result as { response?: unknown; result?: unknown };
  if (typeof value.response === "string") return value.response;
  if (typeof value.result === "string") return value.result;
  if (value.response && typeof value.response === "object") return extractAiText(value.response);
  return "";
}

function parseAiSummaries(text: string, expectedIds: Set<string>) {
  const arrayStart = text.indexOf("[");
  const arrayEnd = text.lastIndexOf("]");
  if (arrayStart < 0 || arrayEnd <= arrayStart) throw new Error("AI 요약 응답에서 JSON 배열을 찾지 못했습니다.");
  const parsed: unknown = JSON.parse(text.slice(arrayStart, arrayEnd + 1));
  if (!Array.isArray(parsed)) throw new Error("AI 요약 응답 형식이 올바르지 않습니다.");
  const summaries = new Map<string, string>();
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const row = item as { id?: unknown; summaryKo?: unknown; summary_ko?: unknown };
    const id = typeof row.id === "string" ? row.id : "";
    const summary = typeof row.summaryKo === "string" ? row.summaryKo : typeof row.summary_ko === "string" ? row.summary_ko : "";
    const normalized = summary.replace(/\s+/g, " ").trim();
    if (expectedIds.has(id) && /[가-힣]/.test(normalized) && normalized.length >= 8 && normalized.length <= 180) summaries.set(id, normalized);
  }
  if (summaries.size !== expectedIds.size) throw new Error(`AI 요약 ${expectedIds.size}건 중 ${summaries.size}건만 유효합니다.`);
  return summaries;
}

const SUMMARY_SYSTEM_PROMPT = "너는 AI Skill 카탈로그의 한국어 편집자다. 주어진 설명만 근거로 각 Skill을 한국어 한 문장으로 요약한다. 영어 설명은 한국어로 번역한 뒤 핵심 기능을 요약하고, 이미 한국어인 설명은 자연스럽게 압축한다. 기능을 추측하거나 과장하지 않는다. 반드시 JSON 배열만 출력하고 형식은 [{\"id\":\"원본 id\",\"summaryKo\":\"한국어 한 문장\"}]이다. 각 요약은 8~180자다.";

async function generateSummaryBatch(env: Pick<SyncEnv, "AI" | "OPENAI_API_KEY" | "OPENAI_MODEL" | "OPENAI_API_BASE_URL">, rows: SummaryRow[]) {
  const input = rows.map((row) => ({ id: row.id, name: row.name, category: row.category, tags: parseJsonArray(row.tags_json), description: row.description.slice(0, 1800) }));
  const messages = [
    { role: "system" as const, content: SUMMARY_SYSTEM_PROMPT },
    { role: "user" as const, content: JSON.stringify(input) },
  ];
  if (env.AI) {
    const result = await env.AI.run(SUMMARY_MODEL, { messages });
    return parseAiSummaries(extractAiText(result), new Set(rows.map((row) => row.id)));
  }
  if (!env.OPENAI_API_KEY) throw new Error("AI 요약 제공자가 연결되지 않았습니다.");
  const baseUrl = (env.OPENAI_API_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model: env.OPENAI_MODEL || "gpt-4o-mini", temperature: 0.2, messages }),
    signal: AbortSignal.timeout(25_000),
  });
  const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }>; error?: { message?: string } };
  if (!response.ok) throw new Error(`OpenAI 요약 요청 실패: ${payload.error?.message ?? response.statusText}`);
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("OpenAI 요약 응답이 비어 있습니다.");
  return parseAiSummaries(content, new Set(rows.map((row) => row.id)));
}

export async function processPendingSkillSummaries(env: SyncEnv, maxPerRun = SUMMARY_MAX_PER_RUN) {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  await ensureSchema(env.DB);
  const pendingResult = await env.DB.prepare("SELECT id, name, description, category, tags_json, content_hash FROM skills WHERE status = 'active' AND summary_status IN ('pending', 'failed') ORDER BY updated_at ASC LIMIT ?").bind(Math.min(Math.max(maxPerRun, 1), 80)).all<SummaryRow>();
  const pending = pendingResult.results ?? [];
  if (pending.length === 0) return { status: "idle", processed: 0, failed: 0, remaining: 0 };
  if (!env.AI && !env.OPENAI_API_KEY) {
    await recordOpsAlerts(env, [{ kind: "quality_issue", severity: "warning", title: "AI 한국어 요약 제공자 미연결", message: `${pending.length}개 Skill의 한국어 요약이 대기 중입니다. Cloudflare Workers AI 바인딩 AI 또는 Sites secret OPENAI_API_KEY를 연결하면 다음 수집 주기에 자동 처리됩니다.`, fingerprint: "summary:provider-missing" }]);
    return { status: "ai_unavailable", processed: 0, failed: 0, remaining: pending.length };
  }

  let processed = 0;
  let failed = 0;
  for (let index = 0; index < pending.length; index += SUMMARY_BATCH_SIZE) {
    const batch = pending.slice(index, index + SUMMARY_BATCH_SIZE);
    try {
      const summaries = await generateSummaryBatch(env, batch);
      const updatedAt = now();
      await env.DB.batch(batch.map((row) => env.DB!.prepare("UPDATE skills SET summary_ko = ?, summary_status = 'generated', summary_updated_at = ?, summary_error = NULL, summary_review_status = 'pending', summary_reviewed_by = NULL, summary_reviewed_at = NULL WHERE id = ? AND content_hash = ?").bind(summaries.get(row.id), updatedAt, row.id, row.content_hash)));
      processed += batch.length;
    } catch (error) {
      failed += batch.length;
      const message = error instanceof Error ? error.message : "AI 한국어 요약 생성에 실패했습니다.";
      await env.DB.batch(batch.map((row) => env.DB!.prepare("UPDATE skills SET summary_status = 'failed', summary_error = ?, summary_review_status = 'pending' WHERE id = ? AND content_hash = ?").bind(message.slice(0, 500), row.id, row.content_hash)));
      await recordOpsAlerts(env, [{ kind: "quality_issue", severity: "warning", title: "AI 한국어 요약 생성 실패", message, fingerprint: `summary:failed:${rowFingerprint(batch)}` }]);
    }
  }
  const remainingRow = await env.DB.prepare("SELECT COUNT(*) AS count FROM skills WHERE status = 'active' AND summary_status IN ('pending', 'failed')").first<{ count: number }>();
  return { status: failed > 0 ? "completed_with_errors" : "completed", processed, failed, remaining: Number(remainingRow?.count ?? 0) };
}

export async function getSummaryMetrics(db: D1Database) {
  await ensureSchema(db);
  const [statuses, reviews, oldest, failures] = await Promise.all([
    db.prepare("SELECT summary_status, COUNT(*) AS count FROM skills WHERE status = 'active' GROUP BY summary_status").all<Record<string, unknown>>(),
    db.prepare("SELECT summary_review_status, COUNT(*) AS count FROM skills WHERE status = 'active' GROUP BY summary_review_status").all<Record<string, unknown>>(),
    db.prepare("SELECT MIN(updated_at) AS value FROM skills WHERE status = 'active' AND summary_status IN ('pending', 'failed')").first<{ value: string | null }>(),
    db.prepare("SELECT id, name, summary_error, updated_at FROM skills WHERE status = 'active' AND summary_status = 'failed' ORDER BY updated_at DESC LIMIT 10").all<Record<string, unknown>>(),
  ]);
  const statusCounts: Record<string, number> = {};
  for (const row of statuses.results ?? []) statusCounts[String(row.summary_status ?? "pending")] = Number(row.count ?? 0);
  const reviewCounts: Record<string, number> = {};
  for (const row of reviews.results ?? []) reviewCounts[String(row.summary_review_status ?? "pending")] = Number(row.count ?? 0);
  return {
    generated: statusCounts.generated ?? 0,
    pending: statusCounts.pending ?? 0,
    failed: statusCounts.failed ?? 0,
    reviewPending: reviewCounts.pending ?? 0,
    needsRevision: reviewCounts.needs_revision ?? 0,
    oldestPendingAt: oldest?.value ?? null,
    failures: (failures.results ?? []).map((row) => ({ id: String(row.id), name: String(row.name), error: row.summary_error ? String(row.summary_error) : "요약 실패 원인 기록 없음", updatedAt: String(row.updated_at) })),
  };
}

export async function retrySkillSummaries(db: D1Database, skillIds: string[] = []) {
  await ensureSchema(db);
  const ids = [...new Set(skillIds.map((id) => id.trim()).filter(Boolean))].slice(0, 100);
  if (ids.length === 0) {
    const result = await db.prepare("UPDATE skills SET summary_status = 'pending', summary_error = NULL, summary_review_status = 'pending', summary_reviewed_by = NULL, summary_reviewed_at = NULL WHERE status = 'active' AND summary_status = 'failed'").run();
    return Number(result.meta?.changes ?? 0);
  }
  const result = await db.prepare(`UPDATE skills SET summary_status = 'pending', summary_error = NULL, summary_review_status = 'pending', summary_reviewed_by = NULL, summary_reviewed_at = NULL WHERE status = 'active' AND id IN (${ids.map(() => "?").join(",")})`).bind(...ids).run();
  return Number(result.meta?.changes ?? 0);
}

export async function reviewSkillSummary(db: D1Database, skillId: string, action: "approve" | "needs_revision", actor: { id: string; email: string | null }) {
  await ensureSchema(db);
  const row = await db.prepare("SELECT summary_status, summary_review_status FROM skills WHERE id = ? AND status = 'active'").bind(skillId).first<{ summary_status: string; summary_review_status: string }>();
  if (!row) throw new Error("Skill을 찾을 수 없습니다.");
  if (action === "approve" && row.summary_status !== "generated") throw new Error("생성된 요약만 승인할 수 있습니다.");
  const updatedAt = now();
  const next = action === "approve" ? "approved" : "needs_revision";
  await db.batch([
    db.prepare(action === "approve"
      ? "UPDATE skills SET summary_review_status = 'approved', summary_reviewed_by = ?, summary_reviewed_at = ? WHERE id = ? AND summary_status = 'generated'"
      : "UPDATE skills SET summary_ko = NULL, summary_status = 'pending', summary_error = NULL, summary_review_status = 'needs_revision', summary_reviewed_by = ?, summary_reviewed_at = ? WHERE id = ?").bind(actor.id, updatedAt, skillId),
    db.prepare("INSERT INTO skill_review_events (id, skill_id, action, from_status, to_status, actor_id, actor_email, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), skillId, `summary_${action}`, row.summary_review_status, next, actor.id, actor.email, action === "approve" ? "AI 한국어 요약 승인" : "AI 한국어 요약 재생성 요청", updatedAt),
  ]);
  return { skillId, action, status: next, updatedAt };
}

function rowFingerprint(rows: SummaryRow[]) {
  return rows.map((row) => row.id).join("|").slice(0, 180);
}

function rowToSkill(row: Record<string, unknown>): CatalogSkill & { status: string; updatedAt: string } {
  return {
    id: String(row.id),
    name: String(row.name),
    category: String(row.category),
    description: String(row.description),
    summaryKo: row.summary_ko ? String(row.summary_ko) : null,
    summaryStatus: row.summary_status === "generated" || row.summary_status === "failed" ? row.summary_status : "pending",
    summaryUpdatedAt: row.summary_updated_at ? String(row.summary_updated_at) : null,
    summaryError: row.summary_error ? String(row.summary_error) : null,
    summaryReviewStatus: row.summary_review_status === "approved" || row.summary_review_status === "needs_revision" ? row.summary_review_status : "pending",
    summaryReviewedBy: row.summary_reviewed_by ? String(row.summary_reviewed_by) : null,
    summaryReviewedAt: row.summary_reviewed_at ? String(row.summary_reviewed_at) : null,
    tags: parseJsonArray(String(row.tags_json ?? "[]")),
    compatibility: parseJsonArray(String(row.compatibility_json ?? "[]")),
    risk: row.risk === "주의" ? "주의" : "낮음",
    region: row.region === "국내" ? "국내" : "해외",
    source: String(row.source),
    sourceUrl: String(row.source_url),
    sourceType: row.source_type === "공식" || row.source_type === "커뮤니티" ? row.source_type : "디렉터리",
    trust: row.trust === "원본 확인" ? "원본 확인" : "검토 필요",
    prompt: String(row.prompt),
    install: String(row.install),
    appUrl: String(row.app_url),
    license: row.license ? String(row.license) : null,
    contentHash: String(row.content_hash),
    discoveredVia: String(row.discovered_via),
    sourceUpdatedAt: row.source_updated_at ? String(row.source_updated_at) : null,
    usageCount: Number(row.usage_count ?? 0),
    favoriteCount: Number(row.favorite_count ?? 0),
    qualityIssueCount: Number(row.quality_issue_count ?? 0),
    approvalStatus: isApprovalStatus(row.approval_status) ? row.approval_status : "review",
    verificationStatus: isVerificationStatus(row.verification_status) ? row.verification_status : "legacy",
    status: String(row.status),
    updatedAt: String(row.updated_at),
  };
}

function isApprovalStatus(value: unknown): value is ApprovalStatus {
  return value === "review" || value === "approved" || value === "rejected" || value === "published";
}

function isVerificationStatus(value: unknown): value is VerificationStatus {
  return value === "unverified" || value === "legacy" || value === "static_passed" || value === "static_warning" || value === "static_blocked" || value === "sandbox_passed" || value === "sandbox_fallback_passed" || value === "sandbox_failed" || value === "sandbox_unavailable";
}

export async function listStoredSkills(db: D1Database, search = "", region = "", category = "", verification = "", sort = "recommended", limit = 120, platform = "") {
  await ensureSchema(db);
  const clauses = ["status = 'active'", "approval_status = 'published'"];
  const args: (string | number)[] = [];
  if (search) {
    clauses.push("(name LIKE ? OR description LIKE ? OR summary_ko LIKE ? OR source LIKE ? OR tags_json LIKE ?)");
    const pattern = `%${search}%`;
    args.push(pattern, pattern, pattern, pattern, pattern);
  }
  if (region && (region === "국내" || region === "해외")) {
    clauses.push("region = ?");
    args.push(region);
  }
  if (category) {
    clauses.push("category = ?");
    args.push(category);
  }
  if (platform) {
    clauses.push("compatibility_json LIKE ?");
    args.push(`%"${platform}"%`);
  }
  if (["sandbox_passed", "sandbox_fallback_passed", "static_passed", "unverified", "static_warning", "static_blocked", "sandbox_failed", "sandbox_unavailable"].includes(verification)) {
    clauses.push("verification_status = ?");
    args.push(verification);
  }
  const order = sort === "name" ? "name ASC" : sort === "verified" ? "CASE WHEN verification_status = 'sandbox_passed' THEN 0 WHEN verification_status = 'static_passed' THEN 1 WHEN verification_status = 'sandbox_fallback_passed' THEN 2 ELSE 3 END, updated_at DESC" : "(favorite_count * 3 + usage_count) DESC, CASE WHEN verification_status = 'sandbox_passed' THEN 0 WHEN verification_status = 'static_passed' THEN 1 WHEN verification_status = 'sandbox_fallback_passed' THEN 2 ELSE 3 END, updated_at DESC, name ASC";
  const statement = db.prepare(`SELECT skills.*, COALESCE((SELECT COUNT(*) FROM skill_usage_events WHERE skill_id = skills.id AND event_type IN ('view', 'copy', 'open') AND created_at >= datetime('now', '-30 days')), 0) AS usage_count, COALESCE((SELECT COUNT(*) FROM skill_favorites WHERE skill_id = skills.id), 0) AS favorite_count, COALESCE((SELECT COUNT(*) FROM skill_quality_issues WHERE skill_id = skills.id AND status = 'open'), 0) AS quality_issue_count FROM skills WHERE ${clauses.join(" AND ")} ORDER BY ${order} LIMIT ?`).bind(...args, Math.min(Math.max(limit, 1), 200));
  const result = await statement.all<Record<string, unknown>>();
  return result.results.map(rowToSkill);
}

export async function getPublishedSkill(db: D1Database, skillId: string) {
  await ensureSchema(db);
  const row = await db.prepare("SELECT skills.*, COALESCE((SELECT COUNT(*) FROM skill_usage_events WHERE skill_id = skills.id AND event_type IN ('view', 'copy', 'open') AND created_at >= datetime('now', '-30 days')), 0) AS usage_count, COALESCE((SELECT COUNT(*) FROM skill_favorites WHERE skill_id = skills.id), 0) AS favorite_count, COALESCE((SELECT COUNT(*) FROM skill_quality_issues WHERE skill_id = skills.id AND status = 'open'), 0) AS quality_issue_count FROM skills WHERE skills.id = ? AND skills.status = 'active' AND skills.approval_status = 'published'").bind(skillId).first<Record<string, unknown>>();
  if (!row) return null;
  return {
    ...rowToSkill(row),
    approvalUpdatedAt: row.approval_updated_at ? String(row.approval_updated_at) : null,
    publishedAt: row.published_at ? String(row.published_at) : null,
    verificationUpdatedAt: row.verification_updated_at ? String(row.verification_updated_at) : null,
    verificationSummary: row.verification_summary ? String(row.verification_summary) : null,
    sourceLinkStatus: String(row.source_link_status ?? "unknown"),
    sourceLinkCheckedAt: row.source_link_checked_at ? String(row.source_link_checked_at) : null,
    sourceLinkError: row.source_link_error ? String(row.source_link_error) : null,
    licensePrevious: row.license_previous ? String(row.license_previous) : null,
    licenseChangedAt: row.license_changed_at ? String(row.license_changed_at) : null,
    updatedAt: String(row.updated_at),
  };
}

type ReviewQueueRow = CatalogSkill & {
  status: string;
  approvalStatus: ApprovalStatus;
  approvalUpdatedAt: string | null;
  approvedBy: string | null;
  publishedAt: string | null;
  verificationStatus: VerificationStatus;
  verificationUpdatedAt: string | null;
  verificationSummary: string | null;
  lastSeenAt: string;
  updatedAt: string;
  sourceLinkStatus: string;
  licensePrevious: string | null;
  licenseChangedAt: string | null;
  duplicateOf: string | null;
};

function rowToReviewQueueItem(row: Record<string, unknown>): ReviewQueueRow {
  const skill = rowToSkill(row);
  return {
    ...skill,
    approvalStatus: isApprovalStatus(row.approval_status) ? row.approval_status : "review",
    approvalUpdatedAt: row.approval_updated_at ? String(row.approval_updated_at) : null,
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    publishedAt: row.published_at ? String(row.published_at) : null,
    verificationStatus: isVerificationStatus(row.verification_status) ? row.verification_status : "legacy",
    verificationUpdatedAt: row.verification_updated_at ? String(row.verification_updated_at) : null,
    verificationSummary: row.verification_summary ? String(row.verification_summary) : null,
    lastSeenAt: String(row.last_seen_at),
    sourceLinkStatus: String(row.source_link_status ?? "unknown"),
    licensePrevious: row.license_previous ? String(row.license_previous) : null,
    licenseChangedAt: row.license_changed_at ? String(row.license_changed_at) : null,
    duplicateOf: row.duplicate_of ? String(row.duplicate_of) : null,
  };
}

export async function listReviewQueue(db: D1Database, approvalStatus = "review", limit = 100) {
  await ensureSchema(db);
  const args: (string | number)[] = [];
  const clauses = ["status = 'active'"];
  if (isApprovalStatus(approvalStatus)) {
    clauses.push("approval_status = ?");
    args.push(approvalStatus);
  }
  const result = await db.prepare(`SELECT * FROM skills WHERE ${clauses.join(" AND ")} ORDER BY CASE approval_status WHEN 'review' THEN 0 WHEN 'approved' THEN 1 WHEN 'rejected' THEN 2 ELSE 3 END, updated_at DESC, name ASC LIMIT ?`).bind(...args, Math.min(Math.max(limit, 1), 200)).all<Record<string, unknown>>();
  const countsResult = await db.prepare("SELECT approval_status, COUNT(*) AS count FROM skills WHERE status = 'active' GROUP BY approval_status").all<Record<string, unknown>>();
  const counts: Record<ApprovalStatus, number> = { review: 0, approved: 0, rejected: 0, published: 0 };
  for (const row of countsResult.results ?? []) {
    if (isApprovalStatus(row.approval_status)) counts[row.approval_status] = Number(row.count ?? 0);
  }
  return { items: result.results.map(rowToReviewQueueItem), counts };
}

export async function changeSkillApproval(
  db: D1Database,
  skillId: string,
  action: ReviewAction,
  actor: { id: string; email?: string | null },
  note?: string | null,
) {
  await ensureSchema(db);
  const row = await db.prepare("SELECT * FROM skills WHERE id = ?").bind(skillId).first<Record<string, unknown>>();
  if (!row) throw new Error("Skill을 찾을 수 없습니다.");
  if (row.status !== "active") throw new Error("오래된 출처의 Skill은 먼저 재수집해야 검토할 수 있습니다.");
  const current = isApprovalStatus(row.approval_status) ? row.approval_status : "review";
  const verificationStatus = isVerificationStatus(row.verification_status) ? row.verification_status : "legacy";
  if (action === "publish" && !["legacy", "static_passed", "sandbox_passed", "sandbox_fallback_passed"].includes(verificationStatus)) {
    throw new Error("공개 전에 정적 검사, 공식 격리 검증 또는 무결성 fallback 검증이 필요합니다.");
  }
  if (action === "publish") {
    const blocker = await db.prepare("SELECT COUNT(*) AS count FROM skill_quality_issues WHERE skill_id = ? AND status = 'open' AND severity = 'blocker'").bind(skillId).first<{ count: number }>();
    if (Number(blocker?.count ?? 0) > 0 || row.source_link_status === "broken") throw new Error("공개 전에 깨진 원본 링크 또는 품질 차단 이슈를 해결해야 합니다.");
  }
  const transitions: Record<ReviewAction, { from: ApprovalStatus[]; to: ApprovalStatus }> = {
    approve: { from: ["review"], to: "approved" },
    publish: { from: ["approved"], to: "published" },
    reject: { from: ["review", "approved", "published"], to: "rejected" },
    review: { from: ["rejected", "published"], to: "review" },
    unpublish: { from: ["published"], to: "approved" },
  };
  const transition = transitions[action];
  if (!transition || !transition.from.includes(current)) {
    throw new Error(`현재 상태(${current})에서는 ${action} 작업을 수행할 수 없습니다.`);
  }
  const updatedAt = now();
  await db.batch([
    db.prepare("UPDATE skills SET approval_status = ?, approval_updated_at = ?, approved_by = ?, published_at = ?, updated_at = ? WHERE id = ?").bind(transition.to, updatedAt, actor.id, transition.to === "published" ? updatedAt : null, updatedAt, skillId),
    db.prepare("INSERT INTO skill_review_events (id, skill_id, action, from_status, to_status, actor_id, actor_email, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), skillId, action, current, transition.to, actor.id, actor.email ?? null, note ?? null, updatedAt),
  ]);
  return { skillId, action, fromStatus: current, toStatus: transition.to, updatedAt };
}

export async function getStoredSkillRecord(db: D1Database, skillId: string) {
  await ensureSchema(db);
  return db.prepare("SELECT * FROM skills WHERE id = ?").bind(skillId).first<Record<string, unknown>>();
}

export async function getSyncStatus(db: D1Database) {
  await ensureSchema(db);
  const [run, sources, active, review, stale] = await Promise.all([
    db.prepare("SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 1").first<Record<string, unknown>>(),
    db.prepare("SELECT id, name, kind, url, region, source_type, enabled, last_synced_at, last_error FROM sync_sources ORDER BY name ASC").all<Record<string, unknown>>(),
    db.prepare("SELECT COUNT(*) AS count FROM skills WHERE status = 'active' AND approval_status = 'published'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM skills WHERE status = 'active' AND approval_status = 'review'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM skills WHERE status = 'stale'").first<{ count: number }>(),
  ]);
  return { activeSkills: Number(active?.count ?? 0), pendingReviews: Number(review?.count ?? 0), staleSkills: Number(stale?.count ?? 0), latestRun: run, sources: sources.results };
}
