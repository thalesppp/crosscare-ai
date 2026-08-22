CREATE TABLE `mutation_rate_limits` (
	`client_key` text NOT NULL,
	`scope` text NOT NULL,
	`window_start` integer NOT NULL,
	`request_count` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`client_key`, `scope`, `window_start`)
);
--> statement-breakpoint
CREATE INDEX `mutation_rate_limits_window_start_idx` ON `mutation_rate_limits` (`window_start`);