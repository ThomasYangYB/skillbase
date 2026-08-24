type SourceKind = "github" | "skills-sh" | "directory";
type Region = "국내" | "해외";
type SourceType = "공식" | "커뮤니티" | "디렉터리";

export type SyncEnv = {
  DB?: D1Database;
  GITHUB_TOKEN?: string;
};

export type CatalogSkill = {
  id: string;
  name: string;
  category: string;
  description: string;
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
    if (path.length !== 3 || path.some((part) => part === "packs" || part === "topics" || part === "official")) continue;
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
    db.prepare("CREATE TABLE IF NOT EXISTS skills (id TEXT PRIMARY KEY, source_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, region TEXT NOT NULL, source TEXT NOT NULL, source_url TEXT NOT NULL, source_type TEXT NOT NULL, compatibility_json TEXT NOT NULL DEFAULT '[]', tags_json TEXT NOT NULL DEFAULT '[]', install TEXT NOT NULL, prompt TEXT NOT NULL, app_url TEXT NOT NULL, risk TEXT NOT NULL, trust TEXT NOT NULL, license TEXT, content_hash TEXT NOT NULL, discovered_via TEXT NOT NULL, source_updated_at TEXT, last_seen_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS sync_sources (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, url TEXT NOT NULL, region TEXT NOT NULL, source_type TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, last_synced_at TEXT, last_error TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS sync_runs (id TEXT PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL, sources_scanned INTEGER NOT NULL DEFAULT 0, candidates_seen INTEGER NOT NULL DEFAULT 0, accepted INTEGER NOT NULL DEFAULT 0, rejected INTEGER NOT NULL DEFAULT 0, error_summary TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skills_status_category ON skills(status, category)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skills_region ON skills(region)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skills_last_seen ON skills(last_seen_at)"),
  ]);
}

async function writeSources(db: D1Database) {
  await db.batch(SYNC_SOURCES.map((source) => db.prepare("INSERT INTO sync_sources (id, name, kind, url, region, source_type) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind, url = excluded.url, region = excluded.region, source_type = excluded.source_type").bind(source.id, source.name, source.kind, source.url, source.region, source.sourceType)));
}

async function writeSkills(db: D1Database, candidates: CatalogSkill[], seenAt: string) {
  const statements = candidates.map(async (skill) => {
    return db.prepare("INSERT INTO skills (id, source_id, name, description, category, region, source, source_url, source_type, compatibility_json, tags_json, install, prompt, app_url, risk, trust, license, content_hash, discovered_via, source_updated_at, last_seen_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?) ON CONFLICT(id) DO UPDATE SET source_id = excluded.source_id, name = excluded.name, description = excluded.description, category = excluded.category, region = excluded.region, source = excluded.source, source_url = excluded.source_url, source_type = excluded.source_type, compatibility_json = excluded.compatibility_json, tags_json = excluded.tags_json, install = excluded.install, prompt = excluded.prompt, app_url = excluded.app_url, risk = excluded.risk, trust = excluded.trust, license = excluded.license, content_hash = excluded.content_hash, discovered_via = excluded.discovered_via, source_updated_at = excluded.source_updated_at, last_seen_at = excluded.last_seen_at, status = 'active', updated_at = excluded.updated_at").bind(
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
    );
  });
  const resolved = await Promise.all(statements);
  for (let index = 0; index < resolved.length; index += 50) await db.batch(resolved.slice(index, index + 50));
}

export async function syncAllSources(env: SyncEnv) {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  const db = env.DB;
  await ensureSchema(db);
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
  await db.prepare("UPDATE sync_runs SET finished_at = ?, status = ?, sources_scanned = ?, candidates_seen = ?, accepted = ?, rejected = ?, error_summary = ? WHERE id = ?").bind(now(), status, SYNC_SOURCES.length, candidatesSeen, accepted, rejected, errors.slice(0, 20).join(" | ") || null, runId).run();
  return { runId, status, sourcesScanned: SYNC_SOURCES.length, candidatesSeen, accepted, rejected, errors: errors.slice(0, 20) };
}

function rowToSkill(row: Record<string, unknown>): CatalogSkill & { status: string; updatedAt: string } {
  return {
    id: String(row.id),
    name: String(row.name),
    category: String(row.category),
    description: String(row.description),
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
    status: String(row.status),
    updatedAt: String(row.updated_at),
  };
}

export async function listStoredSkills(db: D1Database, search = "", region = "", category = "", limit = 120) {
  await ensureSchema(db);
  const clauses = ["status = 'active'"];
  const args: (string | number)[] = [];
  if (search) {
    clauses.push("(name LIKE ? OR description LIKE ? OR source LIKE ? OR tags_json LIKE ?)");
    const pattern = `%${search}%`;
    args.push(pattern, pattern, pattern, pattern);
  }
  if (region && (region === "국내" || region === "해외")) {
    clauses.push("region = ?");
    args.push(region);
  }
  if (category) {
    clauses.push("category = ?");
    args.push(category);
  }
  const statement = db.prepare(`SELECT * FROM skills WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC, name ASC LIMIT ?`).bind(...args, Math.min(Math.max(limit, 1), 200));
  const result = await statement.all<Record<string, unknown>>();
  return result.results.map(rowToSkill);
}

export async function getSyncStatus(db: D1Database) {
  await ensureSchema(db);
  const [run, sources, active] = await Promise.all([
    db.prepare("SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 1").first<Record<string, unknown>>(),
    db.prepare("SELECT id, name, kind, url, region, source_type, enabled, last_synced_at, last_error FROM sync_sources ORDER BY name ASC").all<Record<string, unknown>>(),
    db.prepare("SELECT COUNT(*) AS count FROM skills WHERE status = 'active'").first<{ count: number }>(),
  ]);
  return { activeSkills: Number(active?.count ?? 0), latestRun: run, sources: sources.results };
}
