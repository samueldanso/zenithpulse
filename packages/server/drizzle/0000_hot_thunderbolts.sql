CREATE TABLE `playbooks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`mode` text DEFAULT 'observe' NOT NULL,
	`contract_json` text,
	`contract_derived_at` text,
	`last_observed_at` text,
	`risk_score` real DEFAULT 0,
	`risk_state` text DEFAULT 'healthy',
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `traces` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`playbook_id` text NOT NULL,
	`timestamp` text NOT NULL,
	`live_state_json` text NOT NULL,
	`contract_json` text DEFAULT '{}' NOT NULL,
	`drift_results_json` text NOT NULL,
	`risk_score` real NOT NULL,
	`risk_state` text NOT NULL,
	`enforcement_action` text DEFAULT 'none' NOT NULL,
	`action_target` text,
	`action_result` text,
	`action_error` text,
	`reasoning` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`playbook_id`) REFERENCES `playbooks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_traces_playbook` ON `traces` (`playbook_id`,`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_traces_action` ON `traces` (`enforcement_action`);