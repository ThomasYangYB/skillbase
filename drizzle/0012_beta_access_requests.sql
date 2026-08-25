CREATE TABLE IF NOT EXISTS `beta_access_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `note` text,
  `actor_id` text,
  `status` text DEFAULT 'pending' NOT NULL,
  `consented_at` text NOT NULL,
  `created_at` text NOT NULL,
  `reviewed_by` text,
  `reviewed_at` text,
  `review_note` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_beta_access_requests_status_created` ON `beta_access_requests` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_beta_access_requests_email_created` ON `beta_access_requests` (`email`,`created_at`);
