ALTER TABLE "pet_events" ADD COLUMN "user_id" text;
--> statement-breakpoint
UPDATE "pet_events" SET "details" = '{}'::jsonb WHERE "details" IS NULL;
--> statement-breakpoint
ALTER TABLE "pet_events" ALTER COLUMN "details" SET DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "pet_events" ALTER COLUMN "details" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "pet_events" ADD CONSTRAINT "pet_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "pet_events_user_created_idx" ON "pet_events" USING btree ("user_id", "created_at");
