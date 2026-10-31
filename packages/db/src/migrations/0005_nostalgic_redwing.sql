CREATE TABLE "experimental_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"monitoring_session_id" uuid,
	"name" text NOT NULL,
	"objective" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"code_revision" text,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"environment" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitoring_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"camera_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"detector_model" text,
	"embedding_model" text,
	"code_revision" text,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pet_events" ADD COLUMN "monitoring_session_id" uuid;--> statement-breakpoint
ALTER TABLE "experimental_sessions" ADD CONSTRAINT "experimental_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experimental_sessions" ADD CONSTRAINT "experimental_sessions_monitoring_session_id_monitoring_sessions_id_fk" FOREIGN KEY ("monitoring_session_id") REFERENCES "public"."monitoring_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_sessions" ADD CONSTRAINT "monitoring_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_sessions" ADD CONSTRAINT "monitoring_sessions_camera_id_cameras_id_fk" FOREIGN KEY ("camera_id") REFERENCES "public"."cameras"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experimental_sessions_user_created_idx" ON "experimental_sessions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "experimental_sessions_monitoring_session_idx" ON "experimental_sessions" USING btree ("monitoring_session_id");--> statement-breakpoint
CREATE INDEX "experimental_sessions_user_status_idx" ON "experimental_sessions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "monitoring_sessions_user_started_idx" ON "monitoring_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "monitoring_sessions_user_status_idx" ON "monitoring_sessions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "monitoring_sessions_camera_started_idx" ON "monitoring_sessions" USING btree ("camera_id","started_at");--> statement-breakpoint
ALTER TABLE "pet_events" ADD CONSTRAINT "pet_events_monitoring_session_id_monitoring_sessions_id_fk" FOREIGN KEY ("monitoring_session_id") REFERENCES "public"."monitoring_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pet_events_user_session_created_idx" ON "pet_events" USING btree ("user_id","monitoring_session_id","created_at");--> statement-breakpoint
CREATE INDEX "pet_events_user_type_created_idx" ON "pet_events" USING btree ("user_id","event_type","created_at");