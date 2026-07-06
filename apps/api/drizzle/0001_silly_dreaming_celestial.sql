CREATE TYPE "public"."source_type" AS ENUM('github_url', 'zip');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('draft', 'validating', 'passed', 'warning', 'failed', 'published');--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "submissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"source_type" "source_type" NOT NULL,
	"github_url" text,
	"uploaded_zip_key" text,
	"status" "submission_status" DEFAULT 'draft' NOT NULL,
	"resolved_commit_sha" text,
	"source_hash" text NOT NULL,
	"snapshot_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;