import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, index, boolean, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const cameras = pgTable(
  "cameras",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(), // 'webcam' | 'screen' | 'rtsp'
    source: text("source").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("cameras_user_id_idx").on(table.userId),
    uniqueIndex("cameras_one_default_per_user_idx")
      .on(table.userId)
      .where(sql`${table.isDefault}`),
  ],
);
