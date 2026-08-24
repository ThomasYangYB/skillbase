CREATE TABLE `skill_verification_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`requested_by` text NOT NULL,
	`requested_email` text,
	`source_hash` text NOT NULL,
	`verifier_version` text NOT NULL,
	`summary` text,
	`findings_json` text DEFAULT '[]' NOT NULL,
	`external_job_id` text,
	`created_at` text NOT NULL,
	`started_at` text,
	`finished_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_skill_verification_jobs_skill_status` ON `skill_verification_jobs` (`skill_id`,`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `skills` ADD `verification_status` text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE `skills` ADD `verification_updated_at` text;--> statement-breakpoint
ALTER TABLE `skills` ADD `verification_summary` text;--> statement-breakpoint
UPDATE `skills` SET `verification_status` = 'legacy', `verification_updated_at` = `updated_at`, `verification_summary` = '기존 공개 항목 — 새 검증 파이프라인 도입 전 공개됨' WHERE `status` = 'active' AND `approval_status` = 'published';--> statement-breakpoint
CREATE INDEX `idx_skills_verification_status` ON `skills` (`verification_status`,`updated_at`);
