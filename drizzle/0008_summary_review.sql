ALTER TABLE `skills` ADD `summary_review_status` text NOT NULL DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE `skills` ADD `summary_reviewed_by` text;
--> statement-breakpoint
ALTER TABLE `skills` ADD `summary_reviewed_at` text;
--> statement-breakpoint
CREATE INDEX `idx_skills_summary_review_status` ON `skills` (`summary_review_status`,`updated_at`);
