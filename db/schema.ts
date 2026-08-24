import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  summaryKo: text("summary_ko"),
  summaryStatus: text("summary_status").notNull().default("pending"),
  summaryUpdatedAt: text("summary_updated_at"),
  summaryError: text("summary_error"),
  summaryReviewStatus: text("summary_review_status").notNull().default("pending"),
  summaryReviewedBy: text("summary_reviewed_by"),
  summaryReviewedAt: text("summary_reviewed_at"),
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
  licensePrevious: text("license_previous"),
  licenseChangedAt: text("license_changed_at"),
  contentHash: text("content_hash").notNull(),
  discoveredVia: text("discovered_via").notNull(),
  sourceUpdatedAt: text("source_updated_at"),
  lastSeenAt: text("last_seen_at").notNull(),
  status: text("status").notNull().default("active"),
  approvalStatus: text("approval_status").notNull().default("review"),
  approvalUpdatedAt: text("approval_updated_at"),
  approvedBy: text("approved_by"),
  publishedAt: text("published_at"),
  verificationStatus: text("verification_status").notNull().default("unverified"),
  verificationUpdatedAt: text("verification_updated_at"),
  verificationSummary: text("verification_summary"),
  sourceLinkStatus: text("source_link_status").notNull().default("unknown"),
  sourceLinkCheckedAt: text("source_link_checked_at"),
  sourceLinkError: text("source_link_error"),
  duplicateOf: text("duplicate_of"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  statusCategoryIdx: index("idx_skills_status_category").on(table.status, table.category),
  approvalStatusIdx: index("idx_skills_approval_status").on(table.approvalStatus, table.updatedAt),
  verificationStatusIdx: index("idx_skills_verification_status").on(table.verificationStatus, table.updatedAt),
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

export const skillVerificationJobs = sqliteTable("skill_verification_jobs", {
  id: text("id").primaryKey(),
  skillId: text("skill_id").notNull(),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  requestedBy: text("requested_by").notNull(),
  requestedEmail: text("requested_email"),
  sourceHash: text("source_hash").notNull(),
  verifierVersion: text("verifier_version").notNull(),
  summary: text("summary"),
  findingsJson: text("findings_json").notNull().default("[]"),
  verificationMethod: text("verification_method"),
  durationMs: integer("duration_ms"),
  externalJobId: text("external_job_id"),
  createdAt: text("created_at").notNull(),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
}, (table) => ({
  skillStatusIdx: index("idx_skill_verification_jobs_skill_status").on(table.skillId, table.status, table.createdAt),
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

export const skillFeedback = sqliteTable("skill_feedback", {
  id: text("id").primaryKey(),
  skillId: text("skill_id").notNull(),
  type: text("type").notNull(),
  message: text("message"),
  actorId: text("actor_id"),
  createdAt: text("created_at").notNull(),
}, (table) => ({
  skillIdx: index("idx_skill_feedback_skill").on(table.skillId, table.createdAt),
}));

export const opsAlerts = sqliteTable("ops_alerts", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  fingerprint: text("fingerprint").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
}, (table) => ({
  statusIdx: index("idx_ops_alerts_status_created").on(table.status, table.createdAt),
  fingerprintIdx: index("idx_ops_alerts_fingerprint").on(table.fingerprint, table.createdAt),
}));

export const skillQualityIssues = sqliteTable("skill_quality_issues", {
  id: text("id").primaryKey(),
  skillId: text("skill_id").notNull(),
  kind: text("kind").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("open"),
  message: text("message").notNull(),
  detailsJson: text("details_json").notNull().default("{}"),
  checkedAt: text("checked_at").notNull(),
}, (table) => ({
  skillKindIdx: index("idx_skill_quality_skill_kind").on(table.skillId, table.kind),
  statusIdx: index("idx_skill_quality_status").on(table.status, table.severity),
}));

export const skillUsageEvents = sqliteTable("skill_usage_events", {
  id: text("id").primaryKey(),
  skillId: text("skill_id").notNull(),
  eventType: text("event_type").notNull(),
  actorId: text("actor_id"),
  createdAt: text("created_at").notNull(),
}, (table) => ({
  skillEventIdx: index("idx_skill_usage_skill_event").on(table.skillId, table.eventType, table.createdAt),
  actorIdx: index("idx_skill_usage_actor").on(table.actorId, table.createdAt),
}));

export const skillFavorites = sqliteTable("skill_favorites", {
  id: text("id").primaryKey(),
  skillId: text("skill_id").notNull(),
  actorId: text("actor_id").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => ({
  skillActorIdx: index("idx_skill_favorites_skill_actor").on(table.skillId, table.actorId),
  actorIdx: index("idx_skill_favorites_actor").on(table.actorId, table.createdAt),
}));

export const skillSubmissions = sqliteTable("skill_submissions", {
  id: text("id").primaryKey(),
  actorId: text("actor_id"),
  actorEmail: text("actor_email"),
  name: text("name").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceType: text("source_type").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  install: text("install").notNull(),
  prompt: text("prompt").notNull(),
  status: text("status").notNull().default("pending"),
  reviewerId: text("reviewer_id"),
  reviewNote: text("review_note"),
  createdAt: text("created_at").notNull(),
  reviewedAt: text("reviewed_at"),
}, (table) => ({
  statusIdx: index("idx_skill_submissions_status_created").on(table.status, table.createdAt),
  actorIdx: index("idx_skill_submissions_actor_created").on(table.actorId, table.createdAt),
}));

export const requestRateLimits = sqliteTable("request_rate_limits", {
  key: text("key").notNull(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  primaryKey: primaryKey({ columns: [table.key, table.windowStart] }),
  windowIdx: index("idx_request_rate_limits_window").on(table.windowStart),
}));

export const skillWorkspaces = sqliteTable("skill_workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(),
  ownerEmail: text("owner_email"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  ownerIdx: index("idx_skill_workspaces_owner").on(table.ownerId, table.updatedAt),
}));

export const skillWorkspaceMembers = sqliteTable("skill_workspace_members", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  actorId: text("actor_id"),
  actorEmail: text("actor_email"),
  role: text("role").notNull().default("viewer"),
  status: text("status").notNull().default("invited"),
  inviteTokenHash: text("invite_token_hash"),
  inviteExpiresAt: text("invite_expires_at"),
  joinedAt: text("joined_at"),
  createdAt: text("created_at").notNull(),
}, (table) => ({
  workspaceIdx: index("idx_skill_workspace_members_workspace").on(table.workspaceId, table.status, table.createdAt),
  actorIdx: index("idx_skill_workspace_members_actor").on(table.actorId, table.status),
}));

export const skillWorkspaceItems = sqliteTable("skill_workspace_items", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  skillId: text("skill_id").notNull(),
  note: text("note"),
  addedBy: text("added_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  workspaceIdx: index("idx_skill_workspace_items_workspace").on(table.workspaceId, table.updatedAt),
}));
