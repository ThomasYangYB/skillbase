CREATE INDEX `idx_skills_status_category` ON `skills` (`status`,`category`);--> statement-breakpoint
CREATE INDEX `idx_skills_region` ON `skills` (`region`);--> statement-breakpoint
CREATE INDEX `idx_skills_last_seen` ON `skills` (`last_seen_at`);