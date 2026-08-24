import { recordOpsAlerts, type AlertEnv } from "./alerts";

export type QualityEnv = AlertEnv;
type SkillRow = Record<string, unknown> & { id: string; name: string; content_hash: string; source_url: string };

function now() {
  return new Date().toISOString();
}

async function ensureQualitySchema(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS skill_quality_issues (id TEXT PRIMARY KEY, skill_id TEXT NOT NULL, kind TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', message TEXT NOT NULL, details_json TEXT NOT NULL DEFAULT '{}', checked_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_quality_skill_kind ON skill_quality_issues(skill_id, kind)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_quality_status ON skill_quality_issues(status, severity)"),
  ]);
}

async function upsertIssue(db: D1Database, skillId: string, kind: string, severity: "warning" | "blocker", message: string, details: Record<string, unknown>, checkedAt: string) {
  const existing = await db.prepare("SELECT id FROM skill_quality_issues WHERE skill_id = ? AND kind = ? LIMIT 1").bind(skillId, kind).first<{ id: string }>();
  if (existing) {
    await db.prepare("UPDATE skill_quality_issues SET severity = ?, status = 'open', message = ?, details_json = ?, checked_at = ? WHERE id = ?").bind(severity, message, JSON.stringify(details), checkedAt, existing.id).run();
    return;
  }
  await db.prepare("INSERT INTO skill_quality_issues (id, skill_id, kind, severity, status, message, details_json, checked_at) VALUES (?, ?, ?, ?, 'open', ?, ?, ?)").bind(crypto.randomUUID(), skillId, kind, severity, message, JSON.stringify(details), checkedAt).run();
}

async function checkSourceLink(sourceUrl: string) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      let response = await fetch(sourceUrl, { method: "HEAD", redirect: "follow", signal: controller.signal, headers: { "user-agent": "skillbase-quality-check/1.0" } });
      if (response.status === 405 || response.status === 501) {
        response = await fetch(sourceUrl, { method: "GET", redirect: "follow", signal: controller.signal, headers: { range: "bytes=0-0", "user-agent": "skillbase-quality-check/1.0" } });
      }
      if (response.ok || (response.status >= 300 && response.status < 400)) return { status: "ok" as const, error: null };
      return { status: "broken" as const, error: `${response.status} ${response.statusText}` };
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    return { status: "broken" as const, error: error instanceof Error ? error.message : "출처 링크 확인 실패" };
  }
}

function duplicateKey(row: SkillRow) {
  return `${row.name.trim().toLowerCase()}|${row.content_hash}`;
}

function canonicalRank(row: SkillRow) {
  const sourceType = String(row.source_type ?? "");
  return `${sourceType === "공식" ? "0" : sourceType === "커뮤니티" ? "1" : "2"}:${row.source_url}`;
}

export async function runQualityChecks(env: QualityEnv) {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  const db = env.DB;
  await ensureQualitySchema(db);
  const checkedAt = now();
  await db.prepare("UPDATE skill_quality_issues SET status = 'resolved' WHERE status = 'open'").run();
  await db.prepare("UPDATE skills SET duplicate_of = NULL WHERE status = 'active'").run();
  const rows = (await db.prepare("SELECT * FROM skills WHERE status = 'active' ORDER BY updated_at DESC LIMIT 5000").all<SkillRow>()).results ?? [];
  const duplicateGroups = new Map<string, SkillRow[]>();
  for (const row of rows) {
    const key = duplicateKey(row);
    duplicateGroups.set(key, [...(duplicateGroups.get(key) ?? []), row]);
  }
  let duplicates = 0;
  for (const group of duplicateGroups.values()) {
    if (group.length < 2) continue;
    const [canonical, ...dupes] = [...group].sort((left, right) => canonicalRank(left).localeCompare(canonicalRank(right)));
    for (const row of group) await db.prepare("UPDATE skills SET duplicate_of = ? WHERE id = ?").bind(row.id === canonical.id ? null : canonical.id, row.id).run();
    for (const duplicate of dupes) {
      duplicates += 1;
      await upsertIssue(db, duplicate.id, "duplicate", "warning", `동일한 이름과 원본 해시를 가진 Skill이 있습니다. 대표 항목: ${canonical.name}`, { canonicalId: canonical.id }, checkedAt);
    }
  }
  const linkCandidates = rows.filter((row) => row.source_link_status === "unknown" || row.source_link_status === "broken" || !row.source_link_checked_at || Date.parse(String(row.source_link_checked_at)) < Date.now() - 7 * 86_400_000).slice(0, 60);
  let brokenLinks = 0;
  for (let index = 0; index < linkCandidates.length; index += 8) {
    const batch = linkCandidates.slice(index, index + 8);
    const checked = await Promise.all(batch.map(async (row) => ({ row, link: await checkSourceLink(row.source_url) })));
    for (const { row, link } of checked) {
      await db.prepare("UPDATE skills SET source_link_status = ?, source_link_checked_at = ?, source_link_error = ? WHERE id = ?").bind(link.status, checkedAt, link.error, row.id).run();
      if (link.status === "broken") {
        brokenLinks += 1;
        await upsertIssue(db, row.id, "broken_source", "blocker", `원본 링크를 열 수 없습니다: ${link.error}`, { sourceUrl: row.source_url }, checkedAt);
      }
    }
  }
  let licenseChanges = 0;
  for (const row of rows.filter((item) => Boolean(item.license_changed_at))) {
    licenseChanges += 1;
    await upsertIssue(db, row.id, "license_changed", "warning", `라이선스가 변경되었습니다: ${row.license_previous ?? "미상"} → ${row.license ?? "미상"}`, { previous: row.license_previous ?? null, current: row.license ?? null, changedAt: row.license_changed_at }, checkedAt);
  }
  const alerts = [];
  if (brokenLinks > 0) alerts.push({ kind: "quality_issue" as const, severity: "critical" as const, title: "깨진 Skill 원본 링크 발견", message: `${brokenLinks}개의 원본 링크가 응답하지 않습니다. 운영자 큐에서 공개 전 확인이 필요합니다.`, fingerprint: `quality:broken_source:${brokenLinks}` });
  if (licenseChanges > 0) alerts.push({ kind: "quality_issue" as const, severity: "warning" as const, title: "Skill 라이선스 변경 감지", message: `${licenseChanges}개의 Skill에서 라이선스 변경을 확인했습니다.`, fingerprint: `quality:license_changed:${licenseChanges}` });
  await recordOpsAlerts(env, alerts);
  const open = await db.prepare("SELECT COUNT(*) AS count FROM skill_quality_issues WHERE status = 'open'").first<{ count: number }>();
  return { checked: rows.length, linksChecked: linkCandidates.length, duplicates, brokenLinks, licenseChanges, openIssues: Number(open?.count ?? 0), checkedAt };
}

export async function getQualitySummary(db: D1Database) {
  await ensureQualitySchema(db);
  const [open, blockers, recent] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM skill_quality_issues WHERE status = 'open'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM skill_quality_issues WHERE status = 'open' AND severity = 'blocker'").first<{ count: number }>(),
    db.prepare("SELECT id, skill_id, kind, severity, status, message, checked_at FROM skill_quality_issues WHERE status = 'open' ORDER BY checked_at DESC LIMIT 50").all<Record<string, unknown>>(),
  ]);
  return { open: Number(open?.count ?? 0), blockers: Number(blockers?.count ?? 0), issues: recent.results ?? [] };
}
