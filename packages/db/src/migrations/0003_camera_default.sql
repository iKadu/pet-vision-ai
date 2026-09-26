ALTER TABLE "cameras" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "cameras_one_default_per_user_idx" ON "cameras" USING btree ("user_id") WHERE "cameras"."is_default";
