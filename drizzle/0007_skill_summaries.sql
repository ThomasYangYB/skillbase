ALTER TABLE `skills` ADD `summary_ko` text;
--> statement-breakpoint
ALTER TABLE `skills` ADD `summary_status` text NOT NULL DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE `skills` ADD `summary_updated_at` text;
--> statement-breakpoint
ALTER TABLE `skills` ADD `summary_error` text;
--> statement-breakpoint
CREATE INDEX `idx_skills_summary_status` ON `skills` (`summary_status`,`updated_at`);
