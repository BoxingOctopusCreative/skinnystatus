ALTER TABLE "component" ADD COLUMN "check_type" text;--> statement-breakpoint
ALTER TABLE "component" ADD COLUMN "check_config" text;--> statement-breakpoint
UPDATE "component" SET "check_type" = 'http' WHERE "check_url" IS NOT NULL AND "check_url" <> '';
