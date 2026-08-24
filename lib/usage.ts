import { getStoredSkillRecord } from "./sync";

export const USAGE_EVENT_TYPES = ["view", "copy", "open", "install_verify"] as const;
export type UsageEventType = typeof USAGE_EVENT_TYPES[number];

function now() {
  return new Date().toISOString();
}

async function ensureUsageSchema(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS skill_usage_events (id TEXT PRIMARY KEY, skill_id TEXT NOT NULL, event_type TEXT NOT NULL, actor_id TEXT, created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS skill_favorites (id TEXT PRIMARY KEY, skill_id TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_usage_skill_event ON skill_usage_events(skill_id, event_type, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_usage_actor ON skill_usage_events(actor_id, created_at)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_favorites_unique ON skill_favorites(skill_id, actor_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_favorites_actor ON skill_favorites(actor_id, created_at)"),
  ]);
}

export async function recordUsageEvent(db: D1Database, skillId: string, eventType: UsageEventType, actorId: string | null) {
  await ensureUsageSchema(db);
  const skill = await getStoredSkillRecord(db, skillId);
  if (!skill || skill.status !== "active" || skill.approval_status !== "published") throw new Error("공개된 Skill만 사용 통계를 기록할 수 있습니다.");
  const recent = await db.prepare("SELECT COUNT(*) AS count FROM skill_usage_events WHERE actor_id = ? AND created_at >= datetime('now', '-10 minutes')").bind(actorId).first<{ count: number }>();
  if (Number(recent?.count ?? 0) >= 60) return false;
  const duplicate = await db.prepare("SELECT id FROM skill_usage_events WHERE skill_id = ? AND event_type = ? AND actor_id = ? AND created_at >= datetime('now', '-30 seconds') LIMIT 1").bind(skillId, eventType, actorId).first<{ id: string }>();
  if (duplicate) return false;
  await db.prepare("INSERT INTO skill_usage_events (id, skill_id, event_type, actor_id, created_at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), skillId, eventType, actorId, now()).run();
  return true;
}

export async function listFavoriteIds(db: D1Database, actorId: string) {
  await ensureUsageSchema(db);
  const result = await db.prepare("SELECT skill_id FROM skill_favorites WHERE actor_id = ? ORDER BY created_at DESC LIMIT 500").bind(actorId).all<{ skill_id: string }>();
  return (result.results ?? []).map((row) => String(row.skill_id));
}

export async function setFavorite(db: D1Database, skillId: string, actorId: string, active: boolean) {
  await ensureUsageSchema(db);
  const skill = await getStoredSkillRecord(db, skillId);
  if (!skill || skill.status !== "active" || skill.approval_status !== "published") throw new Error("공개된 Skill만 즐겨찾기에 추가할 수 있습니다.");
  if (active) {
    await db.prepare("INSERT OR IGNORE INTO skill_favorites (id, skill_id, actor_id, created_at) VALUES (?, ?, ?, ?)").bind(crypto.randomUUID(), skillId, actorId, now()).run();
  } else {
    await db.prepare("DELETE FROM skill_favorites WHERE skill_id = ? AND actor_id = ?").bind(skillId, actorId).run();
  }
  return active;
}

export async function getUsageMetrics(db: D1Database, windowDays = 30) {
  await ensureUsageSchema(db);
  const safeDays = Math.min(Math.max(Math.round(windowDays), 1), 365);
  const since = new Date(Date.now() - safeDays * 86_400_000).toISOString();
  const [events, favorites, users, top] = await Promise.all([
    db.prepare("SELECT event_type, COUNT(*) AS count FROM skill_usage_events WHERE created_at >= ? GROUP BY event_type").bind(since).all<Record<string, unknown>>(),
    db.prepare("SELECT COUNT(*) AS count FROM skill_favorites").first<{ count: number }>(),
    db.prepare("SELECT COUNT(DISTINCT actor_id) AS count FROM skill_usage_events WHERE actor_id IS NOT NULL AND created_at >= ?").bind(since).first<{ count: number }>(),
    db.prepare("SELECT s.id, s.name, COUNT(e.id) AS count FROM skill_usage_events e JOIN skills s ON s.id = e.skill_id WHERE e.created_at >= ? GROUP BY s.id, s.name ORDER BY count DESC, s.name ASC LIMIT 10").bind(since).all<Record<string, unknown>>(),
  ]);
  const eventCounts: Record<string, number> = {};
  for (const row of events.results ?? []) eventCounts[String(row.event_type)] = Number(row.count ?? 0);
  return { windowDays: safeDays, events: eventCounts, totalEvents: Object.values(eventCounts).reduce((sum, value) => sum + value, 0), favorites: Number(favorites?.count ?? 0), activeUsers: Number(users?.count ?? 0), topSkills: top.results ?? [] };
}
