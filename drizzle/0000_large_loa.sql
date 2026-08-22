CREATE TABLE `audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` text,
	`actor_id` text DEFAULT 'system' NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_events_case_id_idx` ON `audit_events` (`case_id`);--> statement-breakpoint
CREATE INDEX `audit_events_created_at_idx` ON `audit_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `monitor_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scanned` integer NOT NULL,
	`analyzed` integer NOT NULL,
	`alerted` integer NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `monitor_runs_created_at_idx` ON `monitor_runs` (`created_at`);--> statement-breakpoint
CREATE TABLE `policies` (
	`code` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `support_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`customer_name` text NOT NULL,
	`initials` text NOT NULL,
	`subject` text NOT NULL,
	`channel` text NOT NULL,
	`status` text DEFAULT '待处理' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`tracking_status` text DEFAULT 'unknown' NOT NULL,
	`issue_type` text NOT NULL,
	`anomaly_reason` text DEFAULT '等待 Agent 分析' NOT NULL,
	`recommendation` text DEFAULT '运行 Agent 生成处理建议' NOT NULL,
	`reply_draft` text DEFAULT '' NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`policy_code` text,
	`policy_title` text,
	`source` text DEFAULT 'demo' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `support_cases_status_idx` ON `support_cases` (`status`);--> statement-breakpoint
CREATE INDEX `support_cases_updated_at_idx` ON `support_cases` (`updated_at`);