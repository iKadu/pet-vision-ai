CREATE TABLE "user_monitoring_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"absence_alert_seconds" integer DEFAULT 30 NOT NULL,
	"notification_cooldown_seconds" integer DEFAULT 300 NOT NULL,
	"browser_notifications_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_monitoring_preferences" ADD CONSTRAINT "user_monitoring_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
