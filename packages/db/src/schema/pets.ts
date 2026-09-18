import { pgTable, text, timestamp, uuid, customType, doublePrecision, jsonb, index } from "drizzle-orm/pg-core";

import { user } from "./auth";

// Tipo customizado para suportar o vetor de 512 dimensões (Re-ID)
const vector512 = customType<{ data: number[] }>({
  dataType() {
    return "vector(512)";
  },
});

// 1. Tabela de Pets
export const pets = pgTable("pets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  species: text("species").notNull(), // 'dog' | 'cat'
  breed: text("breed"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [index("pets_user_id_idx").on(table.userId)]);

// 2. Tabela de Embeddings Biométricos
export const petEmbeddings = pgTable(
  "pet_embeddings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    petId: uuid("pet_id")
      .references(() => pets.id, { onDelete: "cascade" })
      .notNull(),
    embedding: vector512("embedding").notNull(),
    modelName: text("model_name").notNull().default("legacy-unknown"),
    pretrainedWeights: text("pretrained_weights").notNull().default("legacy-unknown"),
    sourcePhotoUrl: text("source_photo_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("pet_embeddings_cosine_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
    index("pet_embeddings_pet_id_model_idx").on(table.petId, table.modelName),
  ]
);

// 3. Tabela de Eventos e Logs de Visão Computacional
export const petEvents = pgTable("pet_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  petId: uuid("pet_id").references(() => pets.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(), // 'detection', 'zone_alert', 'inactivity'
  confidence: doublePrecision("confidence"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
