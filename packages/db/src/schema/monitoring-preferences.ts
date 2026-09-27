import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const userMonitoringPreferences = pgTable("user_monitoring_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  absenceAlertSeconds: integer("absence_alert_seconds").notNull().default(30),
  notificationCooldownSeconds: integer("notification_cooldown_seconds")
    .notNull()
    .default(300),
  browserNotificationsEnabled: boolean("browser_notifications_enabled")
    .notNull()
    .default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
