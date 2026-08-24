CREATE TABLE `skill_workspaces` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `owner_id` text NOT NULL,
  `owner_email` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_skill_workspaces_owner` ON `skill_workspaces` (`owner_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `skill_workspace_members` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `actor_id` text,
  `actor_email` text,
  `role` text NOT NULL DEFAULT 'viewer',
  `status` text NOT NULL DEFAULT 'invited',
  `invite_token_hash` text,
  `invite_expires_at` text,
  `joined_at` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_skill_workspace_members_workspace` ON `skill_workspace_members` (`workspace_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_skill_workspace_members_actor` ON `skill_workspace_members` (`actor_id`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_skill_workspace_members_unique_actor` ON `skill_workspace_members` (`workspace_id`,`actor_id`) WHERE `actor_id` IS NOT NULL;
--> statement-breakpoint
CREATE TABLE `skill_workspace_items` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `skill_id` text NOT NULL,
  `note` text,
  `added_by` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_skill_workspace_items_workspace` ON `skill_workspace_items` (`workspace_id`,`updated_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_skill_workspace_items_unique_skill` ON `skill_workspace_items` (`workspace_id`,`skill_id`);
