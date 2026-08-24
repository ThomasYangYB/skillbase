CREATE TABLE `skill_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`type` text NOT NULL,
	`message` text,
	`actor_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_skill_feedback_skill` ON `skill_feedback` (`skill_id`,`created_at`);
