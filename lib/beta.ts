export type BetaAccessStatus = "pending" | "approved" | "invited" | "rejected";

export type BetaAccessRequest = {
  id: string;
  email: string;
  note: string | null;
  actor_id: string | null;
  status: BetaAccessStatus;
  consented_at: string;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
};

async function ensureBetaSchema(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS beta_access_requests (id TEXT PRIMARY KEY, email TEXT NOT NULL, note TEXT, actor_id TEXT, status TEXT NOT NULL DEFAULT 'pending', consented_at TEXT NOT NULL, created_at TEXT NOT NULL, reviewed_by TEXT, reviewed_at TEXT, review_note TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_beta_access_requests_status_created ON beta_access_requests(status, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_beta_access_requests_email_created ON beta_access_requests(email, created_at)"),
  ]);
}

export function normalizeBetaEmail(value: string) {
  return value.trim().toLowerCase().slice(0, 254);
}

export function isValidBetaEmail(value: string) {
  return value.length >= 5 && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function createBetaAccessRequest(db: D1Database, email: string, note: string | null, actorId: string | null) {
  await ensureBetaSchema(db);
  const existing = await db.prepare("SELECT id, status FROM beta_access_requests WHERE email = ? AND status IN ('pending', 'approved', 'invited') ORDER BY created_at DESC LIMIT 1").bind(email).first<{ id: string; status: BetaAccessStatus }>();
  if (existing) return { duplicate: true, id: existing.id, status: existing.status };
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO beta_access_requests (id, email, note, actor_id, status, consented_at, created_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)").bind(id, email, note, actorId, now, now).run();
  return { duplicate: false, id, status: "pending" as const };
}

export async function listBetaAccessRequests(db: D1Database, status?: BetaAccessStatus) {
  await ensureBetaSchema(db);
  const query = status
    ? db.prepare("SELECT * FROM beta_access_requests WHERE status = ? ORDER BY created_at ASC LIMIT 500").bind(status)
    : db.prepare("SELECT * FROM beta_access_requests ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'invited' THEN 2 ELSE 3 END, created_at ASC LIMIT 500");
  const result = await query.all<BetaAccessRequest>();
  return result.results ?? [];
}

export async function reviewBetaAccessRequest(db: D1Database, requestId: string, action: "approve" | "reject" | "mark_invited", actorId: string, note: string | null) {
  await ensureBetaSchema(db);
  const current = await db.prepare("SELECT id, status FROM beta_access_requests WHERE id = ?").bind(requestId).first<{ id: string; status: BetaAccessStatus }>();
  if (!current) throw new Error("베타 신청을 찾을 수 없습니다.");
  const nextStatus: BetaAccessStatus = action === "approve" ? "approved" : action === "mark_invited" ? "invited" : "rejected";
  if (action === "mark_invited" && current.status !== "approved") throw new Error("승인된 신청만 초대 완료로 표시할 수 있습니다.");
  if (action === "approve" && !["pending", "rejected"].includes(current.status)) throw new Error(`현재 상태(${current.status})에서는 승인할 수 없습니다.`);
  const now = new Date().toISOString();
  await db.prepare("UPDATE beta_access_requests SET status = ?, reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?").bind(nextStatus, actorId, now, note, requestId).run();
  return { requestId, status: nextStatus, reviewedAt: now };
}

export async function exportBetaEmails(db: D1Database) {
  await ensureBetaSchema(db);
  const result = await db.prepare("SELECT email, status, created_at, reviewed_at FROM beta_access_requests WHERE status IN ('approved', 'invited') ORDER BY email ASC").all<{ email: string; status: BetaAccessStatus; created_at: string; reviewed_at: string | null }>();
  return result.results ?? [];
}
