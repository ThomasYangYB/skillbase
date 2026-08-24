ALTER TABLE `skills` ADD `license_previous` text;
--> statement-breakpoint
ALTER TABLE `skills` ADD `license_changed_at` text;
--> statement-breakpoint
ALTER TABLE `skills` ADD `source_link_status` text NOT NULL DEFAULT 'unknown';
--> statement-breakpoint
ALTER TABLE `skills` ADD `source_link_checked_at` text;
--> statement-breakpoint
ALTER TABLE `skills` ADD `source_link_error` text;
--> statement-breakpoint
ALTER TABLE `skills` ADD `duplicate_of` text;
--> statement-breakpoint
CREATE TABLE `ops_alerts` (
  `id` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL,
  `severity` text NOT NULL,
  `title` text NOT NULL,
  `message` text NOT NULL,
  `fingerprint` text NOT NULL,
  `status` text NOT NULL DEFAULT 'open',
  `created_at` text NOT NULL,
  `resolved_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_ops_alerts_status_created` ON `ops_alerts` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_ops_alerts_fingerprint` ON `ops_alerts` (`fingerprint`,`created_at`);
--> statement-breakpoint
CREATE TABLE `skill_quality_issues` (
  `id` text PRIMARY KEY NOT NULL,
  `skill_id` text NOT NULL,
  `kind` text NOT NULL,
  `severity` text NOT NULL,
  `status` text NOT NULL DEFAULT 'open',
  `message` text NOT NULL,
  `details_json` text NOT NULL DEFAULT '{}',
  `checked_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_skill_quality_skill_kind` ON `skill_quality_issues` (`skill_id`,`kind`);
--> statement-breakpoint
CREATE INDEX `idx_skill_quality_status` ON `skill_quality_issues` (`status`,`severity`);
--> statement-breakpoint
CREATE TABLE `skill_usage_events` (
  `id` text PRIMARY KEY NOT NULL,
  `skill_id` text NOT NULL,
  `event_type` text NOT NULL,
  `actor_id` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_skill_usage_skill_event` ON `skill_usage_events` (`skill_id`,`event_type`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_skill_usage_actor` ON `skill_usage_events` (`actor_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `skill_favorites` (
  `id` text PRIMARY KEY NOT NULL,
  `skill_id` text NOT NULL,
  `actor_id` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_skill_favorites_skill_actor` ON `skill_favorites` (`skill_id`,`actor_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_skill_favorites_unique` ON `skill_favorites` (`skill_id`,`actor_id`);
--> statement-breakpoint
CREATE INDEX `idx_skill_favorites_actor` ON `skill_favorites` (`actor_id`,`created_at`);
