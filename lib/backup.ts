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
  sync: Record<string, unknown>;
};

async function digest(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createBackupSnapshot(db: D1Database): Promise<BackupSnapshot> {
  const sync = await getSyncStatus(db);
  const [skills, reviewEvents, verificationJobs, feedback, alerts, qualityIssues, usageEvents, favorites] = await Promise.all([
    db.prepare("SELECT * FROM skills ORDER BY updated_at DESC, name ASC").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM skill_review_events ORDER BY created_at DESC LIMIT 5000").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM skill_verification_jobs ORDER BY created_at DESC LIMIT 5000").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM skill_feedback ORDER BY created_at DESC LIMIT 5000").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM ops_alerts ORDER BY created_at DESC LIMIT 5000").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM skill_quality_issues ORDER BY checked_at DESC LIMIT 5000").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM skill_usage_events ORDER BY created_at DESC LIMIT 20000").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM skill_favorites ORDER BY created_at DESC LIMIT 10000").all<Record<string, unknown>>(),
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
    sync: sync as unknown as Record<string, unknown>,
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
  const arrays: Array<[string, unknown]> = [["skills", value.skills], ["reviewEvents", value.reviewEvents], ["verificationJobs", value.verificationJobs], ["feedback", value.feedback], ["alerts", value.alerts], ["qualityIssues", value.qualityIssues], ["usageEvents", value.usageEvents], ["favorites", value.favorites]];
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
    },
    contentHash: serialized ? await digest(serialized) : null,
  };
}
