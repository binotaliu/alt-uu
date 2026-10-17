CREATE TABLE `account_daily_activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`activity_date` text NOT NULL,
	`total_seconds` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_daily_activities_account_id_activity_date_unique` ON `account_daily_activities` (`account_id`,`activity_date`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`nickname` text(30),
	`password` text,
	`hungu_session` text,
	`school_portal_session` text,
	`created_at` integer,
	`updated_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_username_unique` ON `accounts` (`username`);--> statement-breakpoint
CREATE TABLE `attachment_downloads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cid` text(64) NOT NULL,
	`source` text(32) DEFAULT 'hungu' NOT NULL,
	`source_url` text NOT NULL,
	`file_name` text(255),
	`status` text(32) NOT NULL,
	`relative_path` text(512),
	`mime_type` text(255),
	`file_size` integer,
	`error_message` text,
	`started_at` integer,
	`completed_at` integer,
	`expires_at` integer,
	`created_at` integer,
	`updated_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `attachment_downloads_status_index` ON `attachment_downloads` (`status`);--> statement-breakpoint
CREATE INDEX `attachment_downloads_cid_status_index` ON `attachment_downloads` (`cid`,`status`);--> statement-breakpoint
CREATE TABLE `blocked_contents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`board_hash` text(64) NOT NULL,
	`node_hash` text(64) NOT NULL,
	`reason` text(1) NOT NULL,
	`blocked_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blocked_contents_board_hash_node_hash_unique` ON `blocked_contents` (`board_hash`,`node_hash`);--> statement-breakpoint
CREATE TABLE `blocked_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`poster` text NOT NULL,
	`realname` text NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blocked_users_poster_realname_unique` ON `blocked_users` (`poster`,`realname`);--> statement-breakpoint
CREATE TABLE `cache` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint
CREATE INDEX `cache_expires_at_index` ON `cache` (`expires_at`);--> statement-breakpoint
CREATE TABLE `diagnostic_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`occurred_at` integer NOT NULL,
	`type` text NOT NULL,
	`level` text DEFAULT 'info' NOT NULL,
	`source` text DEFAULT 'server' NOT NULL,
	`op` text,
	`request_id` text,
	`summary` text NOT NULL,
	`status` integer,
	`duration_ms` integer,
	`context` text
);
--> statement-breakpoint
CREATE INDEX `diagnostic_events_occurred_at_index` ON `diagnostic_events` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `diagnostic_events_request_id_index` ON `diagnostic_events` (`request_id`);--> statement-breakpoint
CREATE INDEX `diagnostic_events_level_occurred_at_index` ON `diagnostic_events` (`level`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `key_value_store` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `playback_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer,
	`cid` text(64) NOT NULL,
	`activity_id` text(191) NOT NULL,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`position_seconds` real DEFAULT 0 NOT NULL,
	`media_duration_seconds` real,
	`hungu_upload_success` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `playback_progress_account_id_cid_activity_id_unique` ON `playback_progress` (`account_id`,`cid`,`activity_id`);