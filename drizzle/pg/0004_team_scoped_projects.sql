ALTER TABLE "status_page" ADD COLUMN "team_id" text;--> statement-breakpoint
UPDATE "status_page" AS sp
SET "team_id" = sub."team_id"
FROM (
	SELECT "status_page_id", MIN("team_id") AS "team_id"
	FROM "status_page_share"
	GROUP BY "status_page_id"
	HAVING COUNT(*) = 1
) AS sub
WHERE sp."id" = sub."status_page_id" AND sp."team_id" IS NULL;--> statement-breakpoint
DO $$
DECLARE
	r RECORD;
	new_team_id text;
	new_slug text;
	base_slug text;
	n int;
	owner_name text;
	owner_email text;
	team_name text;
BEGIN
	FOR r IN
		SELECT sp."id", sp."owner_id"
		FROM "status_page" sp
		WHERE sp."team_id" IS NULL
	LOOP
		new_team_id := NULL;

		IF r."owner_id" IS NOT NULL THEN
			SELECT t."id" INTO new_team_id
			FROM "team" t
			INNER JOIN "team_member" tm
				ON tm."team_id" = t."id"
				AND tm."user_id" = r."owner_id"
				AND tm."role" = 'owner'
			ORDER BY t."created_at"
			LIMIT 1;
		END IF;

		IF new_team_id IS NULL AND r."owner_id" IS NOT NULL THEN
			SELECT u."name", u."email" INTO owner_name, owner_email
			FROM "user" u
			WHERE u."id" = r."owner_id";

			team_name := COALESCE(NULLIF(TRIM(owner_name), ''), SPLIT_PART(COALESCE(owner_email, 'user'), '@', 1), 'Personal') || '''s team';
			base_slug := LOWER(REGEXP_REPLACE(COALESCE(NULLIF(TRIM(owner_name), ''), SPLIT_PART(COALESCE(owner_email, 'user'), '@', 1), 'user'), '[^a-z0-9]+', '-', 'g'));
			base_slug := TRIM(BOTH '-' FROM base_slug);
			IF base_slug = '' OR base_slug IS NULL THEN
				base_slug := 'team';
			END IF;
			base_slug := LEFT(base_slug, 48);

			new_slug := LEFT(base_slug, 63);
			n := 2;
			WHILE EXISTS (SELECT 1 FROM "team" WHERE "slug" = new_slug) LOOP
				new_slug := LEFT(base_slug, 50) || '-' || n;
				n := n + 1;
				IF n > 100 THEN
					new_slug := 'team-' || SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8);
					EXIT;
				END IF;
			END LOOP;

			new_team_id := gen_random_uuid()::text;
			INSERT INTO "team" ("id", "name", "slug", "created_by_user_id", "created_at", "updated_at")
			VALUES (new_team_id, team_name, new_slug, r."owner_id", NOW(), NOW());
			INSERT INTO "team_member" ("id", "team_id", "user_id", "role", "created_at")
			VALUES (gen_random_uuid()::text, new_team_id, r."owner_id", 'owner', NOW());
		END IF;

		IF new_team_id IS NULL THEN
			SELECT t."id" INTO new_team_id FROM "team" t ORDER BY t."created_at" LIMIT 1;
		END IF;

		IF new_team_id IS NULL THEN
			RAISE EXCEPTION 'Cannot backfill status_page %: no team available', r."id";
		END IF;

		UPDATE "status_page" SET "team_id" = new_team_id WHERE "id" = r."id";
	END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "status_page" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "status_page" ADD CONSTRAINT "status_page_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "status_page_team_idx" ON "status_page" USING btree ("team_id");--> statement-breakpoint
DROP TABLE "status_page_share";
