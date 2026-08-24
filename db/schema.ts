import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  region: text("region").notNull(),
  source: text("source").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceType: text("source_type").notNull(),
  compatibilityJson: text("compatibility_json").notNull().default("[]"),
  tagsJson: text("tags_json").notNull().default("[]"),
  install: text("install").notNull(),
  prompt: text("prompt").notNull(),
  appUrl: text("app_url").notNull(),
  risk: text("risk").notNull(),
  trust: text("trust").notNull(),
  license: text("license"),
  contentHash: text("content_hash").notNull(),
  discoveredVia: text("discovered_via").notNull(),
  sourceUpdatedAt: text("source_updated_at"),
  lastSeenAt: text("last_seen_at").notNull(),
  status: text("status").notNull().default("active"),
  approvalStatus: text("approval_status").notNull().default("review"),
  approvalUpdatedAt: text("approval_updated_at"),
  approvedBy: text("approved_by"),
  publishedAt: text("published_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  statusCategoryIdx: index("idx_skills_status_category").on(table.status, table.category),
  approvalStatusIdx: index("idx_skills_approval_status").on(table.approvalStatus, table.updatedAt),
  regionIdx: index("idx_skills_region").on(table.region),
  lastSeenIdx: index("idx_skills_last_seen").on(table.lastSeenAt),
}));

export const skillReviewEvents = sqliteTable("skill_review_events", {
  id: text("id").primaryKey(),
  skillId: text("skill_id").notNull(),
  action: text("action").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  actorId: text("actor_id").notNull(),
  actorEmail: text("actor_email"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
}, (table) => ({
  skillIdx: index("idx_skill_review_events_skill").on(table.skillId, table.createdAt),
}));

export const syncSources = sqliteTable("sync_sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  url: text("url").notNull(),
  region: text("region").notNull(),
  sourceType: text("source_type").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastSyncedAt: text("last_synced_at"),
  lastError: text("last_error"),
});

export const syncRuns = sqliteTable("sync_runs", {
  id: text("id").primaryKey(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  status: text("status").notNull(),
  sourcesScanned: integer("sources_scanned").notNull().default(0),
  candidatesSeen: integer("candidates_seen").notNull().default(0),
  accepted: integer("accepted").notNull().default(0),
  rejected: integer("rejected").notNull().default(0),
  errorSummary: text("error_summary"),
});
