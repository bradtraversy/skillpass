CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "skill_embeddings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "skill_embeddings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"skill_id" integer NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"content_hash" text NOT NULL,
	"model" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_embeddings_skill_id_unique" UNIQUE("skill_id")
);
--> statement-breakpoint
ALTER TABLE "skill_embeddings" ADD CONSTRAINT "skill_embeddings_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;