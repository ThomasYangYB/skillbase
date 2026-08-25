const DEFAULT_RETENTION_DAYS = 180;

export async function pruneUsageEvents(db: D1Database, retentionDays = DEFAULT_RETENTION_DAYS) {
  const days = Math.min(Math.max(Math.round(retentionDays), 30), 730);
  await db.prepare("CREATE TABLE IF NOT EXISTS skill_usage_events (id TEXT PRIMARY KEY, skill_id TEXT NOT NULL, event_type TEXT NOT NULL, actor_id TEXT, created_at TEXT NOT NULL)").run();
  const result = await db.prepare("DELETE FROM skill_usage_events WHERE created_at < datetime('now', ?)").bind(`-${days} days`).run();
  return { deleted: Number(result.meta?.changes ?? 0), retentionDays: days };
}
