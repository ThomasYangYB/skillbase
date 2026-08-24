ALTER TABLE `skill_verification_jobs` ADD `verification_method` text;
--> statement-breakpoint
ALTER TABLE `skill_verification_jobs` ADD `duration_ms` integer;
--> statement-breakpoint
CREATE INDEX `idx_skill_verification_jobs_method` ON `skill_verification_jobs` (`verification_method`,`created_at`);
