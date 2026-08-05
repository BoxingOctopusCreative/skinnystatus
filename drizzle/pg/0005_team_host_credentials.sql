CREATE TABLE "team_host_credential" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"provider" text NOT NULL,
	"ciphertext" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_host_credential" ADD CONSTRAINT "team_host_credential_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "team_host_credential_team_idx" ON "team_host_credential" USING btree ("team_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "team_host_credential_team_provider_uidx" ON "team_host_credential" USING btree ("team_id","provider");
--> statement-breakpoint
INSERT INTO "team_host_credential" ("id", "team_id", "provider", "ciphertext", "created_at", "updated_at")
SELECT gen_random_uuid()::text, owned."team_id", uhc."provider", uhc."ciphertext", uhc."created_at", uhc."updated_at"
FROM "user_host_credential" uhc
INNER JOIN LATERAL (
	SELECT tm."team_id"
	FROM "team_member" tm
	WHERE tm."user_id" = uhc."user_id" AND tm."role" = 'owner'
	ORDER BY tm."created_at"
) AS owned ON true
ON CONFLICT ("team_id", "provider") DO NOTHING;
--> statement-breakpoint
INSERT INTO "team_host_credential" ("id", "team_id", "provider", "ciphertext", "created_at", "updated_at")
SELECT gen_random_uuid()::text, sole."team_id", uhc."provider", uhc."ciphertext", uhc."created_at", uhc."updated_at"
FROM "user_host_credential" uhc
INNER JOIN LATERAL (
	SELECT tm."team_id"
	FROM "team_member" tm
	WHERE tm."user_id" = uhc."user_id"
	GROUP BY tm."team_id"
	HAVING (
		SELECT COUNT(*) FROM "team_member" tm2 WHERE tm2."user_id" = uhc."user_id"
	) = 1
	LIMIT 1
) AS sole ON true
WHERE NOT EXISTS (
	SELECT 1 FROM "team_member" tm
	WHERE tm."user_id" = uhc."user_id" AND tm."role" = 'owner'
)
ON CONFLICT ("team_id", "provider") DO NOTHING;
--> statement-breakpoint
DROP TABLE "user_host_credential";
