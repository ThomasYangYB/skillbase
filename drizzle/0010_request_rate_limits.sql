CREATE TABLE `request_rate_limits` (
  `key` text NOT NULL,
  `window_start` integer NOT NULL,
  `count` integer NOT NULL DEFAULT 0,
  `updated_at` text NOT NULL,
  PRIMARY KEY (`key`, `window_start`)
);
--> statement-breakpoint
CREATE INDEX `idx_request_rate_limits_window` ON `request_rate_limits` (`window_start`);
