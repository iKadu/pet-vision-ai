import { pgTable, text, timestamp, uuid, customType, doublePrecision, jsonb, index } from "drizzle-orm/pg-core";

// Tipo customizado para suportar o vetor de 512 dimensões (Re-ID)
const vector512 = customType<{ data: number[] }>({
  dataType() {
    return "vector(512)";
  },
});

// 1. Tabela de Pets
export const pets = pgTable("pets", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  species: text("species").notNull(), // 'dog' | 'cat'
  breed: text("breed"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 2. Tabela de Embeddings Biométricos
export const petEmbeddings = pgTable(
  "pet_embeddings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    petId: uuid("pet_id")
      .references(() => pets.id, { onDelete: "cascade" })
      .notNull(),
    embedding: vector512("embedding").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("pet_embeddings_cosine_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
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