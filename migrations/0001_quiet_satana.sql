CREATE TABLE `clutches` (
	`id` text PRIMARY KEY NOT NULL,
	`map` text NOT NULL,
	`side` text NOT NULL,
	`enemies` integer NOT NULL,
	`bomb` text NOT NULL,
	`content` text NOT NULL,
	CONSTRAINT "clutches_enemies_check" CHECK("clutches"."enemies" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE `faceit_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`faceit_id` text,
	`level` integer,
	`elo` integer,
	`band` text DEFAULT 'none' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`checked_at` text,
	`next_check_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "faceit_band_check" CHECK("faceit_profiles"."band" IN ('low','mid','high','none')),
	CONSTRAINT "faceit_level_check" CHECK("faceit_profiles"."level" IS NULL OR "faceit_profiles"."level" BETWEEN 1 AND 10)
);
--> statement-breakpoint
CREATE TABLE `game_patches` (
	`id` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`released_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_patches_version_unique` ON `game_patches` (`version`);--> statement-breakpoint
CREATE TABLE `moderation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tactic_id` text NOT NULL,
	`moderator_id` text NOT NULL,
	`action` text NOT NULL,
	`reason` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`tactic_id`) REFERENCES `tactics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`moderator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `moderation_events_tactic_idx` ON `moderation_events` (`tactic_id`);--> statement-breakpoint
CREATE TABLE `rating_stats` (
	`tactic_id` text NOT NULL,
	`band` text NOT NULL,
	`vote_count` integer DEFAULT 0 NOT NULL,
	`works_sum` integer DEFAULT 0 NOT NULL,
	`easy_sum` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`tactic_id`, `band`),
	FOREIGN KEY (`tactic_id`) REFERENCES `tactics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tactic_media` (
	`id` text PRIMARY KEY NOT NULL,
	`tactic_id` text NOT NULL,
	`private_object_key` text,
	`public_object_key` text,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`checksum` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`verified_at` text,
	FOREIGN KEY (`tactic_id`) REFERENCES `tactics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tactic_media_private_key_idx` ON `tactic_media` (`private_object_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `tactic_media_public_key_idx` ON `tactic_media` (`public_object_key`);--> statement-breakpoint
CREATE TABLE `tactics` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`map` text NOT NULL,
	`side` text NOT NULL,
	`team_size` integer NOT NULL,
	`economy` text NOT NULL,
	`difficulty` integer NOT NULL,
	`spawn_dependent` integer DEFAULT false NOT NULL,
	`content` text NOT NULL,
	`game_version` text NOT NULL,
	`source` text NOT NULL,
	`author_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tactics_team_size_check" CHECK("tactics"."team_size" BETWEEN 2 AND 5),
	CONSTRAINT "tactics_difficulty_check" CHECK("tactics"."difficulty" BETWEEN 1 AND 3),
	CONSTRAINT "tactics_status_check" CHECK("tactics"."status" IN ('draft','pending','published','rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tactics_slug_unique` ON `tactics` (`slug`);--> statement-breakpoint
CREATE INDEX `tactics_catalog_idx` ON `tactics` (`map`,`status`,`side`,`team_size`);--> statement-breakpoint
CREATE INDEX `tactics_author_idx` ON `tactics` (`author_id`);--> statement-breakpoint
CREATE TABLE `votes` (
	`user_id` text NOT NULL,
	`tactic_id` text NOT NULL,
	`band` text NOT NULL,
	`works` integer NOT NULL,
	`easy` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `tactic_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tactic_id`) REFERENCES `tactics`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "votes_works_check" CHECK("votes"."works" BETWEEN 1 AND 5),
	CONSTRAINT "votes_easy_check" CHECK("votes"."easy" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE INDEX `votes_tactic_band_idx` ON `votes` (`tactic_id`,`band`);