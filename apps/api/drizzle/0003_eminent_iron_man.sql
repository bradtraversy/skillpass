CREATE TYPE "public"."skill_status" AS ENUM('published', 'draft', 'private', 'flagged');--> statement-breakpoint
CREATE TYPE "public"."version_source_type" AS ENUM('github', 'zip');--> statement-breakpoint
CREATE TABLE "skill_passports" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "skill_passports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"skill_version_id" integer NOT NULL,
	"passport" jsonb NOT NULL,
	"validation_status" "validation_status" NOT NULL,
	"risk_level" "risk_level" NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "skill_passports_skill_version_id_unique" UNIQUE("skill_version_id")
);
--> statement-breakpoint
CREATE TABLE "skill_versions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "skill_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"skill_id" integer NOT NULL,
	"version" text NOT NULL,
	"source_type" "version_source_type" NOT NULL,
	"github_repo_url" text,
	"resolved_commit_sha" text,
	"source_hash" text NOT NULL,
	"snapshot_key" text NOT NULL,
	"submission_id" integer NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_versions_submission_id_unique" UNIQUE("submission_id")
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "skills_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"summary" text NOT NULL,
	"maintainer_id" integer NOT NULL,
	"attributed_to" text,
	"status" "skill_status" NOT NULL,
	"latest_version_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skills_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "skill_passports" ADD CONSTRAINT "skill_passports_skill_version_id_skill_versions_id_fk" FOREIGN KEY ("skill_version_id") REFERENCES "public"."skill_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_maintainer_id_users_id_fk" FOREIGN KEY ("maintainer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_latest_version_id_skill_versions_id_fk" FOREIGN KEY ("latest_version_id") REFERENCES "public"."skill_versions"("id") ON DELETE no action ON UPDATE no action;