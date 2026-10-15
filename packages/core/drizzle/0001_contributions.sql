CREATE TABLE "contribution_days" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"count" integer NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contribution_days_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "contribution_syncs" (
	"user_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	CONSTRAINT "contribution_syncs_user_id_year_pk" PRIMARY KEY("user_id","year")
);
--> statement-breakpoint
CREATE TABLE "contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"github_node_id" text,
	"repo_id" uuid,
	"repo_owner_is_user" boolean NOT NULL,
	"title" text,
	"url" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"date" date NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"pr_state" text,
	"pr_merged_at" timestamp with time zone,
	"counted" boolean NOT NULL,
	"excluded_reason" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contributions_user_dedupe_key" UNIQUE("user_id","dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "goal_periods" (
	"goal_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"achieved_at" timestamp with time zone,
	CONSTRAINT "goal_periods_goal_id_period_start_pk" PRIMARY KEY("goal_id","period_start")
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"target" integer NOT NULL,
	"recurrence" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"repo_scope" text DEFAULT 'all' NOT NULL,
	"repo_id" uuid,
	"is_public" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_streaks" (
	"user_id" uuid NOT NULL,
	"period" text NOT NULL,
	"current_length" integer DEFAULT 0 NOT NULL,
	"longest_length" integer DEFAULT 0 NOT NULL,
	"current_start" date,
	"last_counted_period" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_streaks_user_id_period_pk" PRIMARY KEY("user_id","period")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "github_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_public" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "streak_period" text DEFAULT 'week' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "streak_reminders" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "goal_emails" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "owner_github_id" bigint;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "is_private" boolean;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "is_fork" boolean;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "license_spdx_id" text;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "is_open_source" boolean;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "classified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contribution_days" ADD CONSTRAINT "contribution_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_syncs" ADD CONSTRAINT "contribution_syncs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_periods" ADD CONSTRAINT "goal_periods_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contributions_user_date_idx" ON "contributions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "contributions_repo_id_idx" ON "contributions" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "goals_user_id_idx" ON "goals" USING btree ("user_id");