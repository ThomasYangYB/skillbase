CREATE TABLE `skill_submissions` (
  `id` text PRIMARY KEY NOT NULL,
  `actor_id` text,
  `actor_email` text,
  `name` text NOT NULL,
  `source_url` text NOT NULL,
  `source_type` text NOT NULL,
  `category` text NOT NULL,
  `description` text NOT NULL,
  `install` text NOT NULL,
  `prompt` text NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `reviewer_id` text,
  `review_note` text,
  `created_at` text NOT NULL,
  `reviewed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_skill_submissions_status_created` ON `skill_submissions` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_skill_submissions_actor_created` ON `skill_submissions` (`actor_id`,`created_at`);
