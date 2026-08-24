CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`region` text NOT NULL,
	`source` text NOT NULL,
	`source_url` text NOT NULL,
	`source_type` text NOT NULL,
	`compatibility_json` text DEFAULT '[]' NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`install` text NOT NULL,
	`prompt` text NOT NULL,
	`app_url` text NOT NULL,
	`risk` text NOT NULL,
	`trust` text NOT NULL,
	`license` text,
	`content_hash` text NOT NULL,
	`discovered_via` text NOT NULL,
	`source_updated_at` text,
	`last_seen_at` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`sources_scanned` integer DEFAULT 0 NOT NULL,
	`candidates_seen` integer DEFAULT 0 NOT NULL,
	`accepted` integer DEFAULT 0 NOT NULL,
	`rejected` integer DEFAULT 0 NOT NULL,
	`error_summary` text
);
--> statement-breakpoint
CREATE TABLE `sync_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`url` text NOT NULL,
	`region` text NOT NULL,
	`source_type` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`last_synced_at` text,
	`last_error` text
);
