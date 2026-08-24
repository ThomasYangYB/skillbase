CREATE TABLE `skill_review_events` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_skill_review_events_skill` ON `skill_review_events` (`skill_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `skills` ADD `approval_status` text DEFAULT 'review' NOT NULL;--> statement-breakpoint
ALTER TABLE `skills` ADD `approval_updated_at` text;--> statement-breakpoint
ALTER TABLE `skills` ADD `approved_by` text;--> statement-breakpoint
ALTER TABLE `skills` ADD `published_at` text;--> statement-breakpoint
UPDATE `skills` SET `approval_status` = 'published', `approval_updated_at` = `updated_at`, `published_at` = `updated_at` WHERE `status` = 'active';--> statement-breakpoint
CREATE INDEX `idx_skills_approval_status` ON `skills` (`approval_status`,`updated_at`);
