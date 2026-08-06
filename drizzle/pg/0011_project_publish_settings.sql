-- Move publish settings from team → status_page (per project).
ALTER TABLE "status_page" ADD COLUMN IF NOT EXISTS "publish_base_domain" text;--> statement-breakpoint
ALTER TABLE "status_page" ADD COLUMN IF NOT EXISTS "publish_path_prefix" text DEFAULT 's' NOT NULL;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'team'
			AND column_name = 'publish_path_prefix'
	) THEN
		UPDATE "status_page" sp
		SET
			"publish_base_domain" = t."publish_base_domain",
			"publish_path_prefix" = COALESCE(NULLIF(t."publish_path_prefix", ''), 's')
		FROM "team" t
		WHERE sp."team_id" = t."id";
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "team" DROP COLUMN IF EXISTS "publish_base_domain";--> statement-breakpoint
ALTER TABLE "team" DROP COLUMN IF EXISTS "publish_path_prefix";
