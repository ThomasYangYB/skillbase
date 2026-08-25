import { getSyncStatus } from "./sync";

export type BackupSnapshot = {
  exportedAt: string;
  skills: Array<Record<string, unknown>>;
  reviewEvents: Array<Record<string, unknown>>;
  verificationJobs: Array<Record<string, unknown>>;
  feedback: Array<Record<string, unknown>>;
  alerts: Array<Record<string, unknown>>;
  qualityIssues: Array<Record<string, unknown>>;
  usageEvents: Array<Record<string, unknown>>;
  favorites: Array<Record<string, unknown>>;
  submissions?: Array<Record<string, unknown>>;
  workspaces?: Array<Record<string, unknown>>;
  workspaceMembers?: Array<Record<string, unknown>>;
  workspaceItems?: Array<Record<string, unknown>>;
  betaAccessRequests?: Array<Record<string, unknown>>;
  sync: Record<string, unknown>;
};

async function digest(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createBackupSnapshot(db: D1Database): Promise<BackupSnapshot> {
  const sync = await getSyncStatus(db);
  const [skills, reviewEvents, verificationJobs, feedback, alerts, qualityIssues, usageEvents, favorites, submissions, workspaces, workspaceMembers, workspaceItems, betaAccessRequests] = await Promise.all([
    db.prepare("SELECT * FROM skills ORDER BY updated_at DESC, name ASC").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM skill_review_events ORDER BY created_at DESC LIMIT 5000").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM skill_verification_jobs ORDER BY created_at DESC LIMIT 5000").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM skill_feedback ORDER BY created_at DESC LIMIT 5000").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM ops_alerts ORDER BY created_at DESC LIMIT 5000").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM skill_quality_issues ORDER BY checked_at DESC LIMIT 5000").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM skill_usage_events ORDER BY created_at DESC LIMIT 20000").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM skill_favorites ORDER BY created_at DESC LIMIT 10000").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM skill_submissions ORDER BY created_at DESC LIMIT 10000").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM skill_workspaces ORDER BY updated_at DESC LIMIT 5000").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM skill_workspace_members ORDER BY created_at DESC LIMIT 10000").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM skill_workspace_items ORDER BY updated_at DESC LIMIT 20000").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM beta_access_requests ORDER BY created_at DESC LIMIT 10000").all<Record<string, unknown>>(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    skills: skills.results ?? [],
    reviewEvents: reviewEvents.results ?? [],
    verificationJobs: verificationJobs.results ?? [],
    feedback: feedback.results ?? [],
    alerts: alerts.results ?? [],
    qualityIssues: qualityIssues.results ?? [],
    usageEvents: usageEvents.results ?? [],
    favorites: favorites.results ?? [],
    submissions: submissions.results ?? [],
    workspaces: workspaces.results ?? [],
    workspaceMembers: workspaceMembers.results ?? [],
    workspaceItems: workspaceItems.results ?? [],
    betaAccessRequests: betaAccessRequests.results ?? [],
    sync: sync as unknown as Record<string, unknown>,
  };
}

function restoreRows(value: unknown) {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object")) : [];
}

export function buildRestorePlan(snapshot: BackupSnapshot, contentHash: string | null, warnings: string[]) {
  const tables = [
    { key: "skills", table: "skills", order: 1, required: ["id", "source_url"] },
    { key: "reviewEvents", table: "skill_review_events", order: 2, required: ["id", "skill_id"] },
    { key: "verificationJobs", table: "skill_verification_jobs", order: 3, required: ["id", "skill_id"] },
    { key: "feedback", table: "skill_feedback", order: 4, required: ["id", "skill_id"] },
    { key: "alerts", table: "ops_alerts", order: 5, required: ["id"] },
    { key: "qualityIssues", table: "skill_quality_issues", order: 6, required: ["id", "skill_id"] },
    { key: "usageEvents", table: "skill_usage_events", order: 7, required: ["id", "skill_id"] },
    { key: "favorites", table: "skill_favorites", order: 8, required: ["id", "skill_id", "actor_id"] },
    { key: "submissions", table: "skill_submissions", order: 9, required: ["id", "name", "source_url"] },
    { key: "workspaces", table: "skill_workspaces", order: 10, required: ["id", "name", "owner_id"] },
    { key: "workspaceMembers", table: "skill_workspace_members", order: 11, required: ["id", "workspace_id"] },
    { key: "workspaceItems", table: "skill_workspace_items", order: 12, required: ["id", "workspace_id", "skill_id"] },
    { key: "betaAccessRequests", table: "beta_access_requests", order: 13, required: ["id", "email", "status"] },
  ] as const;
  const skillIds = new Set(restoreRows(snapshot.skills).map((row) => String(row.id ?? "")).filter(Boolean));
  const relationWarnings = [
    ["reviewEvents", restoreRows(snapshot.reviewEvents)],
    ["verificationJobs", restoreRows(snapshot.verificationJobs)],
    ["feedback", restoreRows(snapshot.feedback)],
    ["qualityIssues", restoreRows(snapshot.qualityIssues)],
    ["usageEvents", restoreRows(snapshot.usageEvents)],
    ["favorites", restoreRows(snapshot.favorites)],
  ].flatMap(([name, rows]) => {
    const orphaned = (rows as Record<string, unknown>[]).filter((row) => !skillIds.has(String(row.skill_id ?? ""))).length;
    return orphaned > 0 ? [`${name}에서 연결된 Skill이 없는 행 ${orphaned}건`] : [];
  });
  const fieldWarnings = tables.flatMap((entry) => restoreRows(snapshot[entry.key]).flatMap((row) => entry.required.some((field) => !String(row[field] ?? "")) ? [`${entry.table}에 필수 필드가 없는 행이 있습니다.`] : []));
  const allWarnings = [...new Set([...warnings, ...relationWarnings, ...fieldWarnings])];
  return {
    ready: allWarnings.length === 0,
    execution: "dry-run",
    target: "격리된 staging D1에서 실행할 복구 계획",
    destructive: false,
    checksum: contentHash,
    order: tables.map((entry) => entry.table),
    tables: tables.map((entry) => ({ table: entry.table, order: entry.order, rows: restoreRows(snapshot[entry.key]).length, required: entry.required, conflictPolicy: "기존 행을 덮어쓰지 않는 사전 점검" })),
    warnings: allWarnings,
  };
}

export async function validateBackupSnapshot(snapshot: unknown) {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!snapshot || typeof snapshot !== "object") return { ok: false, errors: ["백업 JSON 객체가 아닙니다."], warnings, counts: {}, contentHash: null };
  const value = snapshot as Partial<BackupSnapshot>;
  for (const key of ["exportedAt", "skills", "reviewEvents", "verificationJobs", "feedback", "alerts", "qualityIssues", "usageEvents", "favorites", "sync"] as const) {
    if (!(key in value)) errors.push(`${key} 필드가 없습니다.`);
  }
  if (!("submissions" in value)) warnings.push("이전 백업 포맷이라 사용자 제출 데이터가 없습니다.");
  else if (!Array.isArray(value.submissions)) errors.push("submissions 배열이 아닙니다.");
  for (const [key, label] of [["workspaces", "비공개 공간"], ["workspaceMembers", "비공개 공간 멤버"], ["workspaceItems", "비공개 공간 Skill"], ["betaAccessRequests", "베타 접근 신청"]] as const) {
    if (!(key in value)) warnings.push(`이전 백업 포맷이라 ${label} 데이터가 없습니다.`);
    else if (!Array.isArray(value[key])) errors.push(`${key} 배열이 아닙니다.`);
  }
  const arrays: Array<[string, unknown]> = [["skills", value.skills], ["reviewEvents", value.reviewEvents], ["verificationJobs", value.verificationJobs], ["feedback", value.feedback], ["alerts", value.alerts], ["qualityIssues", value.qualityIssues], ["usageEvents", value.usageEvents], ["favorites", value.favorites], ["submissions", value.submissions ?? []], ["workspaces", value.workspaces ?? []], ["workspaceMembers", value.workspaceMembers ?? []], ["workspaceItems", value.workspaceItems ?? []], ["betaAccessRequests", value.betaAccessRequests ?? []]];
  for (const [name, entries] of arrays) if (!Array.isArray(entries)) errors.push(`${name} 배열이 아닙니다.`);
  const skills = Array.isArray(value.skills) ? value.skills : [];
  const ids = skills.map((row) => typeof row === "object" && row ? String((row as Record<string, unknown>).id ?? "") : "");
  const uniqueIds = new Set(ids.filter(Boolean));
  if (uniqueIds.size !== ids.length) errors.push("Skill ID가 중복되어 복구 순서를 결정할 수 없습니다.");
  if (skills.some((row) => !row || typeof row !== "object" || !String((row as Record<string, unknown>).id ?? "") || !String((row as Record<string, unknown>).source_url ?? ""))) errors.push("필수 Skill 식별자 또는 원본 링크가 누락되었습니다.");
  const skillIds = new Set(ids);
  const orphanEvents = (Array.isArray(value.reviewEvents) ? value.reviewEvents : []).filter((row) => row && typeof row === "object" && !skillIds.has(String((row as Record<string, unknown>).skill_id ?? ""))).length;
  if (orphanEvents > 0) warnings.push(`Skill이 삭제된 감사 이벤트 ${orphanEvents}건이 있습니다.`);
  if (skills.length === 0) warnings.push("복구할 Skill 데이터가 0건입니다.");
  let serialized = "";
  try {
    serialized = JSON.stringify(snapshot);
    JSON.parse(serialized);
  } catch {
    errors.push("백업 JSON을 안정적으로 직렬화할 수 없습니다.");
  }
  const contentHash = serialized ? await digest(serialized) : null;
  const normalized = {
    exportedAt: String(value.exportedAt ?? ""),
    skills: Array.isArray(value.skills) ? value.skills as Array<Record<string, unknown>> : [],
    reviewEvents: Array.isArray(value.reviewEvents) ? value.reviewEvents as Array<Record<string, unknown>> : [],
    verificationJobs: Array.isArray(value.verificationJobs) ? value.verificationJobs as Array<Record<string, unknown>> : [],
    feedback: Array.isArray(value.feedback) ? value.feedback as Array<Record<string, unknown>> : [],
    alerts: Array.isArray(value.alerts) ? value.alerts as Array<Record<string, unknown>> : [],
    qualityIssues: Array.isArray(value.qualityIssues) ? value.qualityIssues as Array<Record<string, unknown>> : [],
    usageEvents: Array.isArray(value.usageEvents) ? value.usageEvents as Array<Record<string, unknown>> : [],
    favorites: Array.isArray(value.favorites) ? value.favorites as Array<Record<string, unknown>> : [],
    submissions: Array.isArray(value.submissions) ? value.submissions as Array<Record<string, unknown>> : [],
    workspaces: Array.isArray(value.workspaces) ? value.workspaces as Array<Record<string, unknown>> : [],
    workspaceMembers: Array.isArray(value.workspaceMembers) ? value.workspaceMembers as Array<Record<string, unknown>> : [],
    workspaceItems: Array.isArray(value.workspaceItems) ? value.workspaceItems as Array<Record<string, unknown>> : [],
    betaAccessRequests: Array.isArray(value.betaAccessRequests) ? value.betaAccessRequests as Array<Record<string, unknown>> : [],
    sync: value.sync && typeof value.sync === "object" ? value.sync as Record<string, unknown> : {},
  } satisfies BackupSnapshot;
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    counts: {
      skills: skills.length,
      reviewEvents: Array.isArray(value.reviewEvents) ? value.reviewEvents.length : 0,
      verificationJobs: Array.isArray(value.verificationJobs) ? value.verificationJobs.length : 0,
      feedback: Array.isArray(value.feedback) ? value.feedback.length : 0,
      alerts: Array.isArray(value.alerts) ? value.alerts.length : 0,
      qualityIssues: Array.isArray(value.qualityIssues) ? value.qualityIssues.length : 0,
      usageEvents: Array.isArray(value.usageEvents) ? value.usageEvents.length : 0,
      favorites: Array.isArray(value.favorites) ? value.favorites.length : 0,
      submissions: Array.isArray(value.submissions) ? value.submissions.length : 0,
      workspaces: Array.isArray(value.workspaces) ? value.workspaces.length : 0,
      workspaceMembers: Array.isArray(value.workspaceMembers) ? value.workspaceMembers.length : 0,
      workspaceItems: Array.isArray(value.workspaceItems) ? value.workspaceItems.length : 0,
      betaAccessRequests: Array.isArray(value.betaAccessRequests) ? value.betaAccessRequests.length : 0,
    },
    contentHash,
    restorePlan: buildRestorePlan(normalized, contentHash, warnings),
  };
}
