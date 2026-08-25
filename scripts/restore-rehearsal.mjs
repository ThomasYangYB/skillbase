import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationNames = [
  "0000_aberrant_thunderbird.sql",
  "0001_dear_marten_broadcloak.sql",
  "0002_supreme_zodiak.sql",
  "0003_supreme_brood.sql",
  "0004_verification_observability.sql",
  "0005_skill_feedback.sql",
  "0006_operational_quality_usage.sql",
  "0007_skill_summaries.sql",
  "0008_summary_review.sql",
  "0009_skill_submissions.sql",
  "0010_request_rate_limits.sql",
  "0011_private_workspaces.sql",
  "0012_beta_access_requests.sql",
];

const restoreTables = [
  ["skills", "skills"],
  ["reviewEvents", "skill_review_events"],
  ["verificationJobs", "skill_verification_jobs"],
  ["feedback", "skill_feedback"],
  ["alerts", "ops_alerts"],
  ["qualityIssues", "skill_quality_issues"],
  ["usageEvents", "skill_usage_events"],
  ["favorites", "skill_favorites"],
  ["submissions", "skill_submissions"],
  ["workspaces", "skill_workspaces"],
  ["workspaceMembers", "skill_workspace_members"],
  ["workspaceItems", "skill_workspace_items"],
  ["betaAccessRequests", "beta_access_requests"],
];

function sqlIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8").trim();
}

function executeMigrations(db) {
  for (const name of migrationNames) {
    const source = requireText(name);
    for (const statement of source.split(/--> statement-breakpoint\s*/).map((part) => part.trim()).filter(Boolean)) db.exec(statement);
  }
}

function requireText(name) {
  return readFileSync(join(root, "drizzle", name), "utf8").replace(/^\uFEFF/, "");
}

function insertRows(db, table, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  let inserted = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") throw new Error(`${table}: 객체가 아닌 행이 있습니다.`);
    const columns = Object.keys(row);
    if (columns.length === 0) throw new Error(`${table}: 빈 행이 있습니다.`);
    const statement = db.prepare(`INSERT INTO ${sqlIdentifier(table)} (${columns.map(sqlIdentifier).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`);
    statement.run(...columns.map((column) => row[column] ?? null));
    inserted += 1;
  }
  return inserted;
}

const raw = await readStdin();
if (!raw) throw new Error("stdin으로 백업 JSON을 전달하세요.");
const snapshot = JSON.parse(raw);
const db = new DatabaseSync(":memory:");
executeMigrations(db);

const counts = {};
for (const [key, table] of restoreTables) counts[table] = insertRows(db, table, snapshot[key] ?? []);
const restoredSkills = db.prepare("SELECT COUNT(*) AS count FROM skills").get().count;
if (Number(restoredSkills) !== counts.skills) throw new Error(`skills 복구 수가 일치하지 않습니다: ${restoredSkills}/${counts.skills}`);

const orphanEvents = db.prepare("SELECT COUNT(*) AS count FROM skill_review_events e LEFT JOIN skills s ON s.id = e.skill_id WHERE s.id IS NULL").get().count;
if (Number(orphanEvents) > 0) throw new Error(`연결된 Skill이 없는 감사 이벤트가 ${orphanEvents}건입니다.`);
const orphanWorkspaceMembers = db.prepare("SELECT COUNT(*) AS count FROM skill_workspace_members m LEFT JOIN skill_workspaces w ON w.id = m.workspace_id WHERE w.id IS NULL").get().count;
const orphanWorkspaceItems = db.prepare("SELECT COUNT(*) AS count FROM skill_workspace_items i LEFT JOIN skill_workspaces w ON w.id = i.workspace_id LEFT JOIN skills s ON s.id = i.skill_id WHERE w.id IS NULL OR s.id IS NULL").get().count;
if (Number(orphanWorkspaceMembers) > 0 || Number(orphanWorkspaceItems) > 0) throw new Error(`비공개 공간 참조가 끊긴 행이 있습니다: 멤버 ${orphanWorkspaceMembers}건, Skill ${orphanWorkspaceItems}건.`);

console.log(JSON.stringify({ ok: true, mode: "isolated-sqlite-restore", destructive: false, tables: counts, restoredSkills: Number(restoredSkills), orphanEvents: Number(orphanEvents), orphanWorkspaceMembers: Number(orphanWorkspaceMembers), orphanWorkspaceItems: Number(orphanWorkspaceItems) }));
