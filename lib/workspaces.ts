import { getStoredSkillRecord } from "./sync";

export type WorkspaceActor = { id: string; email: string | null };
export type WorkspaceRole = "owner" | "editor" | "viewer";

async function digest(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function now() {
  return new Date().toISOString();
}

export async function ensureWorkspaceSchema(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS skill_workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id TEXT NOT NULL, owner_email TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS skill_workspace_members (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, actor_id TEXT, actor_email TEXT, role TEXT NOT NULL DEFAULT 'viewer', status TEXT NOT NULL DEFAULT 'invited', invite_token_hash TEXT, invite_expires_at TEXT, joined_at TEXT, created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS skill_workspace_items (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, skill_id TEXT NOT NULL, note TEXT, added_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_workspaces_owner ON skill_workspaces(owner_id, updated_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_workspace_members_workspace ON skill_workspace_members(workspace_id, status, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_workspace_members_actor ON skill_workspace_members(actor_id, status)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_workspace_members_unique_actor ON skill_workspace_members(workspace_id, actor_id) WHERE actor_id IS NOT NULL"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_skill_workspace_items_workspace ON skill_workspace_items(workspace_id, updated_at)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_workspace_items_unique_skill ON skill_workspace_items(workspace_id, skill_id)"),
  ]);
}

async function personalWorkspaceId(actorId: string) {
  return `personal:${(await digest(actorId)).slice(0, 32)}`;
}

async function ensurePersonalWorkspace(db: D1Database, actor: WorkspaceActor) {
  const id = await personalWorkspaceId(actor.id);
  const timestamp = now();
  await db.prepare("INSERT OR IGNORE INTO skill_workspaces (id, name, owner_id, owner_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, "내 비공개 보관함", actor.id, actor.email, timestamp, timestamp).run();
  return id;
}

export async function listWorkspaces(db: D1Database, actor: WorkspaceActor) {
  await ensureWorkspaceSchema(db);
  await ensurePersonalWorkspace(db, actor);
  const result = await db.prepare("SELECT w.id, w.name, w.owner_id, w.owner_email, w.created_at, w.updated_at, CASE WHEN w.owner_id = ? THEN 'owner' ELSE COALESCE(m.role, 'viewer') END AS role FROM skill_workspaces w LEFT JOIN skill_workspace_members m ON m.workspace_id = w.id AND m.actor_id = ? AND m.status = 'active' WHERE w.owner_id = ? OR m.actor_id = ? ORDER BY w.updated_at DESC, w.name ASC").bind(actor.id, actor.id, actor.id, actor.id).all<Record<string, unknown>>();
  return (result.results ?? []).map((row) => ({ id: String(row.id), name: String(row.name), role: String(row.role) as WorkspaceRole, ownerId: String(row.owner_id), ownerEmail: row.owner_email ? String(row.owner_email) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at) }));
}

export async function createWorkspace(db: D1Database, actor: WorkspaceActor, name: string) {
  await ensureWorkspaceSchema(db);
  const timestamp = now();
  const id = `workspace:${crypto.randomUUID()}`;
  await db.prepare("INSERT INTO skill_workspaces (id, name, owner_id, owner_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, name, actor.id, actor.email, timestamp, timestamp).run();
  return { id, name, role: "owner" as const, ownerId: actor.id, ownerEmail: actor.email, createdAt: timestamp, updatedAt: timestamp };
}

export async function getWorkspaceAccess(db: D1Database, workspaceId: string, actor: WorkspaceActor) {
  await ensureWorkspaceSchema(db);
  const workspace = await db.prepare("SELECT id, name, owner_id, owner_email, created_at, updated_at FROM skill_workspaces WHERE id = ?").bind(workspaceId).first<Record<string, unknown>>();
  if (!workspace) return null;
  if (String(workspace.owner_id) === actor.id) return { workspace, role: "owner" as WorkspaceRole };
  const member = await db.prepare("SELECT role FROM skill_workspace_members WHERE workspace_id = ? AND actor_id = ? AND status = 'active'").bind(workspaceId, actor.id).first<{ role: string }>();
  if (!member) return null;
  return { workspace, role: (member.role === "editor" ? "editor" : "viewer") as WorkspaceRole };
}

export async function getWorkspaceDetails(db: D1Database, workspaceId: string, actor: WorkspaceActor) {
  const access = await getWorkspaceAccess(db, workspaceId, actor);
  if (!access) throw new Error("비공개 공간에 접근할 권한이 없습니다.");
  const [items, members] = await Promise.all([
    db.prepare("SELECT i.id, i.skill_id, i.note, i.added_by, i.created_at, i.updated_at, s.name, s.category, s.summary_ko, s.description, s.source, s.source_url FROM skill_workspace_items i JOIN skills s ON s.id = i.skill_id WHERE i.workspace_id = ? AND s.status = 'active' AND s.approval_status = 'published' ORDER BY i.updated_at DESC").bind(workspaceId).all<Record<string, unknown>>(),
    db.prepare("SELECT id, actor_id, actor_email, role, status, invite_expires_at, joined_at, created_at FROM skill_workspace_members WHERE workspace_id = ? ORDER BY created_at ASC").bind(workspaceId).all<Record<string, unknown>>(),
  ]);
  return {
    id: String(access.workspace.id),
    name: String(access.workspace.name),
    role: access.role,
    ownerId: String(access.workspace.owner_id),
    ownerEmail: access.workspace.owner_email ? String(access.workspace.owner_email) : null,
    items: items.results ?? [],
    members: members.results ?? [],
  };
}

export async function addWorkspaceSkill(db: D1Database, workspaceId: string, actor: WorkspaceActor, skillId: string, note: string | null) {
  const access = await getWorkspaceAccess(db, workspaceId, actor);
  if (!access || access.role === "viewer") throw new Error("Skill을 추가할 권한이 없습니다.");
  const skill = await getStoredSkillRecord(db, skillId);
  if (!skill || skill.status !== "active" || skill.approval_status !== "published") throw new Error("공개된 Skill만 비공개 공간에 추가할 수 있습니다.");
  const timestamp = now();
  await db.prepare("INSERT INTO skill_workspace_items (id, workspace_id, skill_id, note, added_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(workspace_id, skill_id) DO UPDATE SET note = excluded.note, added_by = excluded.added_by, updated_at = excluded.updated_at").bind(crypto.randomUUID(), workspaceId, skillId, note, actor.id, timestamp, timestamp).run();
  return { skillId, workspaceId, updatedAt: timestamp };
}

export async function removeWorkspaceSkill(db: D1Database, workspaceId: string, actor: WorkspaceActor, skillId: string) {
  const access = await getWorkspaceAccess(db, workspaceId, actor);
  if (!access || access.role === "viewer") throw new Error("Skill을 삭제할 권한이 없습니다.");
  await db.prepare("DELETE FROM skill_workspace_items WHERE workspace_id = ? AND skill_id = ?").bind(workspaceId, skillId).run();
  return { skillId, workspaceId, removed: true };
}

async function inviteToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function inviteWorkspaceMember(db: D1Database, workspaceId: string, actor: WorkspaceActor, email: string, role: "editor" | "viewer" = "viewer") {
  const access = await getWorkspaceAccess(db, workspaceId, actor);
  if (!access || access.role !== "owner") throw new Error("소유자만 멤버를 초대할 수 있습니다.");
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db.prepare("SELECT id FROM skill_workspace_members WHERE workspace_id = ? AND actor_email = ? AND status IN ('active', 'invited') LIMIT 1").bind(workspaceId, normalizedEmail).first<{ id: string }>();
  if (existing) throw new Error("이미 초대했거나 참여 중인 이메일입니다.");
  const token = await inviteToken();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare("INSERT INTO skill_workspace_members (id, workspace_id, actor_email, role, status, invite_token_hash, invite_expires_at, created_at) VALUES (?, ?, ?, ?, 'invited', ?, ?, ?)").bind(crypto.randomUUID(), workspaceId, normalizedEmail, role === "editor" ? "editor" : "viewer", await digest(token), expires, now()).run();
  return { token, expiresAt: expires };
}

export async function acceptWorkspaceInvite(db: D1Database, actor: WorkspaceActor, token: string) {
  await ensureWorkspaceSchema(db);
  const hash = await digest(token.trim());
  const invite = await db.prepare("SELECT id, workspace_id, actor_email, invite_expires_at FROM skill_workspace_members WHERE invite_token_hash = ? AND status = 'invited'").bind(hash).first<Record<string, unknown>>();
  if (!invite) throw new Error("유효하지 않거나 이미 사용한 초대 링크입니다.");
  if (Date.parse(String(invite.invite_expires_at ?? "")) < Date.now()) throw new Error("초대 링크가 만료되었습니다.");
  if (!actor.email || actor.email.toLowerCase() !== String(invite.actor_email).toLowerCase()) throw new Error("초대한 이메일 계정으로 로그인해야 합니다.");
  await db.prepare("UPDATE skill_workspace_members SET actor_id = ?, status = 'active', joined_at = ?, invite_token_hash = NULL WHERE id = ? AND status = 'invited'").bind(actor.id, now(), String(invite.id)).run();
  return { workspaceId: String(invite.workspace_id), joined: true };
}

export async function removeWorkspaceMember(db: D1Database, workspaceId: string, actor: WorkspaceActor, memberId: string) {
  const access = await getWorkspaceAccess(db, workspaceId, actor);
  if (!access || access.role !== "owner") throw new Error("소유자만 멤버를 관리할 수 있습니다.");
  await db.prepare("DELETE FROM skill_workspace_members WHERE id = ? AND workspace_id = ?").bind(memberId, workspaceId).run();
  return { removed: true };
}
