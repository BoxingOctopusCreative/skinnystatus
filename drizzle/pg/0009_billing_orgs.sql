CREATE TABLE "billing_org" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"plan_id" text DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_subscription_status" text,
	"current_period_end" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "billing_org_member" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "billing_org_id" text;--> statement-breakpoint
DO $$
DECLARE
	r RECORD;
	new_org_id text;
	new_slug text;
	base_slug text;
	n int;
	owner_name text;
	owner_email text;
	org_name text;
	owner_user_id text;
BEGIN
	-- One billing org per distinct team creator; attach their teams.
	FOR r IN
		SELECT DISTINCT t."created_by_user_id" AS user_id
		FROM "team" t
		WHERE t."billing_org_id" IS NULL
	LOOP
		SELECT u."name", u."email" INTO owner_name, owner_email
		FROM "user" u
		WHERE u."id" = r.user_id;

		org_name := COALESCE(NULLIF(TRIM(owner_name), ''), SPLIT_PART(COALESCE(owner_email, 'user'), '@', 1), 'Personal') || '''s org';
		base_slug := LOWER(REGEXP_REPLACE(COALESCE(NULLIF(TRIM(owner_name), ''), SPLIT_PART(COALESCE(owner_email, 'user'), '@', 1), 'user'), '[^a-z0-9]+', '-', 'g'));
		base_slug := TRIM(BOTH '-' FROM base_slug);
		IF base_slug = '' OR base_slug IS NULL THEN
			base_slug := 'org';
		END IF;
		base_slug := LEFT(base_slug, 48) || '-org';

		new_slug := LEFT(base_slug, 63);
		n := 2;
		WHILE EXISTS (SELECT 1 FROM "billing_org" WHERE "slug" = new_slug) LOOP
			new_slug := LEFT(base_slug, 50) || '-' || n;
			n := n + 1;
			IF n > 100 THEN
				new_slug := 'org-' || SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8);
				EXIT;
			END IF;
		END LOOP;

		new_org_id := gen_random_uuid()::text;
		INSERT INTO "billing_org" ("id", "name", "slug", "plan_id", "created_by_user_id", "created_at", "updated_at")
		VALUES (new_org_id, org_name, new_slug, 'free', r.user_id, NOW(), NOW());
		INSERT INTO "billing_org_member" ("id", "org_id", "user_id", "role", "created_at")
		VALUES (gen_random_uuid()::text, new_org_id, r.user_id, 'owner', NOW());

		UPDATE "team" SET "billing_org_id" = new_org_id
		WHERE "created_by_user_id" = r.user_id AND "billing_org_id" IS NULL;
	END LOOP;

	-- Orphans: teams still missing billing_org_id (e.g. creator gone). Use current owner member.
	FOR r IN
		SELECT t."id" AS team_id
		FROM "team" t
		WHERE t."billing_org_id" IS NULL
	LOOP
		owner_user_id := NULL;
		SELECT tm."user_id" INTO owner_user_id
		FROM "team_member" tm
		WHERE tm."team_id" = r.team_id AND tm."role" = 'owner'
		ORDER BY tm."created_at"
		LIMIT 1;

		IF owner_user_id IS NULL THEN
			SELECT tm."user_id" INTO owner_user_id
			FROM "team_member" tm
			WHERE tm."team_id" = r.team_id
			ORDER BY tm."created_at"
			LIMIT 1;
		END IF;

		IF owner_user_id IS NULL THEN
			RAISE EXCEPTION 'Cannot backfill team %: no members', r.team_id;
		END IF;

		SELECT bo."id" INTO new_org_id
		FROM "billing_org" bo
		INNER JOIN "billing_org_member" bom
			ON bom."org_id" = bo."id"
			AND bom."user_id" = owner_user_id
			AND bom."role" = 'owner'
		ORDER BY bo."created_at"
		LIMIT 1;

		IF new_org_id IS NULL THEN
			SELECT u."name", u."email" INTO owner_name, owner_email
			FROM "user" u
			WHERE u."id" = owner_user_id;

			org_name := COALESCE(NULLIF(TRIM(owner_name), ''), SPLIT_PART(COALESCE(owner_email, 'user'), '@', 1), 'Personal') || '''s org';
			base_slug := LOWER(REGEXP_REPLACE(COALESCE(NULLIF(TRIM(owner_name), ''), SPLIT_PART(COALESCE(owner_email, 'user'), '@', 1), 'user'), '[^a-z0-9]+', '-', 'g'));
			base_slug := TRIM(BOTH '-' FROM base_slug);
			IF base_slug = '' OR base_slug IS NULL THEN
				base_slug := 'org';
			END IF;
			base_slug := LEFT(base_slug, 48) || '-org';

			new_slug := LEFT(base_slug, 63);
			n := 2;
			WHILE EXISTS (SELECT 1 FROM "billing_org" WHERE "slug" = new_slug) LOOP
				new_slug := LEFT(base_slug, 50) || '-' || n;
				n := n + 1;
				IF n > 100 THEN
					new_slug := 'org-' || SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8);
					EXIT;
				END IF;
			END LOOP;

			new_org_id := gen_random_uuid()::text;
			INSERT INTO "billing_org" ("id", "name", "slug", "plan_id", "created_by_user_id", "created_at", "updated_at")
			VALUES (new_org_id, org_name, new_slug, 'free', owner_user_id, NOW(), NOW());
			INSERT INTO "billing_org_member" ("id", "org_id", "user_id", "role", "created_at")
			VALUES (gen_random_uuid()::text, new_org_id, owner_user_id, 'owner', NOW());
		END IF;

		UPDATE "team" SET "billing_org_id" = new_org_id WHERE "id" = r.team_id;
	END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "team" ALTER COLUMN "billing_org_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_org" ADD CONSTRAINT "billing_org_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_org_member" ADD CONSTRAINT "billing_org_member_org_id_billing_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."billing_org"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_org_member" ADD CONSTRAINT "billing_org_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_billing_org_id_billing_org_id_fk" FOREIGN KEY ("billing_org_id") REFERENCES "public"."billing_org"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_org_created_by_idx" ON "billing_org" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_org_stripe_customer_uidx" ON "billing_org" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "billing_org_member_org_idx" ON "billing_org_member" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "billing_org_member_user_idx" ON "billing_org_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_org_member_org_user_uidx" ON "billing_org_member" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "team_billing_org_idx" ON "team" USING btree ("billing_org_id");--> statement-breakpoint
ALTER TABLE "billing_org" ADD CONSTRAINT "billing_org_slug_unique" UNIQUE("slug");
