ALTER TABLE "team" ADD COLUMN IF NOT EXISTS "publish_base_domain" text;--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN IF NOT EXISTS "publish_path_prefix" text DEFAULT 's' NOT NULL;
