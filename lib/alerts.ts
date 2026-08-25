export type OpsAlertInput = {
  kind: "sync_failure" | "verification_failure" | "quality_issue" | "backup_failure" | "security" | "operational_health";
  severity: "warning" | "critical";
  title: string;
  message: string;
  fingerprint: string;
};

export type AlertEnv = {
  DB?: D1Database;
  SKILLBASE_ALERT_WEBHOOK_URL?: string;
};

function now() {
  return new Date().toISOString();
}

async function sendWebhook(env: AlertEnv, alert: OpsAlertInput) {
  if (!env.SKILLBASE_ALERT_WEBHOOK_URL) return;
  try {
    await fetch(env.SKILLBASE_ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "skillbase-ops-alert/1.0" },
      body: JSON.stringify({ source: "skillbase", alert, createdAt: now() }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.error("Skillbase alert webhook failed", error);
  }
}

export async function recordOpsAlerts(env: AlertEnv, alerts: OpsAlertInput[]) {
  if (!env.DB || alerts.length === 0) return 0;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS ops_alerts (id TEXT PRIMARY KEY, kind TEXT NOT NULL, severity TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, fingerprint TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, resolved_at TEXT)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_ops_alerts_status_created ON ops_alerts(status, created_at)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_ops_alerts_fingerprint ON ops_alerts(fingerprint, created_at)"),
  ]);
  const createdAt = now();
  const cooldown = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  let created = 0;
  for (const alert of alerts.slice(0, 20)) {
    const existing = await env.DB.prepare("SELECT id FROM ops_alerts WHERE fingerprint = ? AND status = 'open' AND created_at >= ? LIMIT 1").bind(alert.fingerprint, cooldown).first<{ id: string }>();
    if (existing) continue;
    await env.DB.prepare("INSERT INTO ops_alerts (id, kind, severity, title, message, fingerprint, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)").bind(crypto.randomUUID(), alert.kind, alert.severity, alert.title, alert.message.slice(0, 2000), alert.fingerprint.slice(0, 240), createdAt).run();
    created += 1;
    await sendWebhook(env, alert);
  }
  return created;
}

export async function listOpsAlerts(db: D1Database, status = "open", limit = 50) {
  const result = await db.prepare("SELECT id, kind, severity, title, message, status, created_at, resolved_at FROM ops_alerts WHERE status = ? ORDER BY created_at DESC LIMIT ?").bind(status, Math.min(Math.max(limit, 1), 100)).all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function resolveOpsAlert(db: D1Database, id: string) {
  return db.prepare("UPDATE ops_alerts SET status = 'resolved', resolved_at = ? WHERE id = ? AND status = 'open'").bind(now(), id).run();
}
