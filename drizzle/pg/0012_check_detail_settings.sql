-- Per-project settings for the uptime-bar check detail drill-down.
-- Both default to false so existing projects keep leaking nothing until an owner opts in.
ALTER TABLE "status_page" ADD COLUMN IF NOT EXISTS "check_details_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "status_page" ADD COLUMN IF NOT EXISTS "check_details_include_errors" boolean DEFAULT false NOT NULL;
