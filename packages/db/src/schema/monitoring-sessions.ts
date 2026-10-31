import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { cameras } from "./cameras";

/**
 * Uma execução contínua do monitoramento. Ela agrupa os eventos produzidos
 * pelo AI Engine para que relatórios operacionais não dependam apenas da data.
 */
export const monitoringSessions = pgTable(
  "monitoring_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    cameraId: uuid("camera_id").references(() => cameras.id, { onDelete: "set null" }),
    status: text("status").notNull().default("active"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    detectorModel: text("detector_model"),
    embeddingModel: text("embedding_model"),
    codeRevision: text("code_revision"),
    configuration: jsonb("configuration").notNull().default({}),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("monitoring_sessions_user_started_idx").on(table.userId, table.startedAt),
    index("monitoring_sessions_user_status_idx").on(table.userId, table.status),
    index("monitoring_sessions_camera_started_idx").on(table.cameraId, table.startedAt),
  ],
);

/**
 * Contexto reprodutível para ensaios acadêmicos, separado das sessões de uso
 * cotidiano. Os resultados e anotações serão vinculados a esta entidade nas
 * próximas etapas do módulo de relatórios.
 */
export const experimentalSessions = pgTable(
  "experimental_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    monitoringSessionId: uuid("monitoring_session_id").references(() => monitoringSessions.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    objective: text("objective"),
    status: text("status").notNull().default("draft"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    codeRevision: text("code_revision"),
    configuration: jsonb("configuration").notNull().default({}),
    environment: jsonb("environment").notNull().default({}),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("experimental_sessions_user_created_idx").on(table.userId, table.createdAt),
    index("experimental_sessions_monitoring_session_idx").on(table.monitoringSessionId),
    index("experimental_sessions_user_status_idx").on(table.userId, table.status),
  ],
);
