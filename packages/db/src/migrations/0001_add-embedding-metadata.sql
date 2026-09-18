ALTER TABLE "pet_embeddings" ADD COLUMN "model_name" text DEFAULT 'legacy-unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "pet_embeddings" ADD COLUMN "pretrained_weights" text DEFAULT 'legacy-unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "pet_embeddings" ADD COLUMN "source_photo_url" text;--> statement-breakpoint
CREATE INDEX "pet_embeddings_pet_id_model_idx" ON "pet_embeddings" USING btree ("pet_id","model_name");