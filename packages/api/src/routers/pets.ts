import { db } from "@tccpet/db";
import { petEmbeddings, petEvents, pets } from "@tccpet/db/schema/pets";
import { env } from "@tccpet/env/server";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm/sql/functions/vector";
import z from "zod";

import { protectedProcedure, router } from "../index";

const petIdInput = z.object({
  id: z.string().uuid(),
});

const embeddingInput = z.object({
  petId: z.string().uuid(),
  values: z.array(z.number().finite()).length(512),
  modelName: z.string().trim().min(1).max(150),
  pretrainedWeights: z.string().trim().min(1).max(150),
  sourcePhotoUrl: z.string().trim().min(1).max(500).nullable(),
});

const embeddingMatchInput = z.object({
  values: z.array(z.number().finite()).length(512),
  modelName: z.string().trim().min(1).max(150),
  pretrainedWeights: z.string().trim().min(1).max(150),
  species: z.enum(["dog", "cat"]).optional(),
});

const identificationEventInput = z.object({
  petId: z.string().uuid(),
  confidence: z.number().finite().min(0).max(1),
  details: z.object({
    trackId: z.number().int().nonnegative(),
    source: z.string().trim().min(1).max(500),
  }),
});

const monitoringEventTypes = ["identification", "detection", "metrics", "activity_changed", "zone_entered", "zone_exited"] as const;
const monitoringEventInput = z.object({
  petId: z.string().uuid().nullable().optional(),
  eventType: z.enum(monitoringEventTypes),
  confidence: z.number().finite().min(0).max(1).nullable().optional(),
  details: z.record(z.string(), z.unknown()),
});

const MINIMUM_EMBEDDING_SIMILARITY = env.PET_MATCH_MIN_SIMILARITY;
const MINIMUM_EMBEDDING_MARGIN = env.PET_MATCH_MIN_MARGIN;
const MAX_PET_EMBEDDING_REFERENCES = 5;
const MAX_EMBEDDING_CANDIDATES = 50;

const petFields = {
  name: z.string().trim().min(1).max(100),
  species: z.enum(["dog", "cat"]),
  breed: z.string().trim().max(100).nullable().optional(),
  photoUrl: z.string().trim().max(500).nullable().optional(),
};

export const petsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(pets)
      .where(eq(pets.userId, ctx.session.user.id))
      .orderBy(desc(pets.createdAt));
  }),

  getById: protectedProcedure
    .input(petIdInput)
    .query(async ({ ctx, input }) => {
      const [pet] = await db
        .select()
        .from(pets)
        .where(and(eq(pets.id, input.id), eq(pets.userId, ctx.session.user.id)))
        .limit(1);

      if (!pet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pet não encontrado",
        });
      }

      return pet;
    }),

  create: protectedProcedure
    .input(z.object(petFields))
    .mutation(async ({ ctx, input }) => {
      const [pet] = await db
        .insert(pets)
        .values({
          userId: ctx.session.user.id,
          name: input.name,
          species: input.species,
          breed: input.breed ?? null,
          photoUrl: input.photoUrl ?? null,
        })
        .returning();

      return pet;
    }),

  createEmbedding: protectedProcedure
    .input(embeddingInput)
    .mutation(async ({ ctx, input }) => {
      const [pet] = await db
        .select({ id: pets.id })
        .from(pets)
        .where(
          and(
            eq(pets.id, input.petId),
            eq(pets.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (!pet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pet não encontrado",
        });
      }

      const [embeddingCount] = await db
        .select({ count: count() })
        .from(petEmbeddings)
        .where(eq(petEmbeddings.petId, pet.id));

      if ((embeddingCount?.count ?? 0) >= MAX_PET_EMBEDDING_REFERENCES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cada pet pode ter até ${MAX_PET_EMBEDDING_REFERENCES} fotos de referência`,
        });
      }

      const [embedding] = await db
        .insert(petEmbeddings)
        .values({
          petId: pet.id,
          embedding: input.values,
          modelName: input.modelName,
          pretrainedWeights: input.pretrainedWeights,
          sourcePhotoUrl: input.sourcePhotoUrl,
        })
        .returning({
          id: petEmbeddings.id,
          petId: petEmbeddings.petId,
          modelName: petEmbeddings.modelName,
          pretrainedWeights: petEmbeddings.pretrainedWeights,
          sourcePhotoUrl: petEmbeddings.sourcePhotoUrl,
          createdAt: petEmbeddings.createdAt,
        });

      return embedding;
    }),

  listEmbeddingReferences: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: petEmbeddings.id,
        petId: petEmbeddings.petId,
        sourcePhotoUrl: petEmbeddings.sourcePhotoUrl,
        createdAt: petEmbeddings.createdAt,
      })
      .from(petEmbeddings)
      .innerJoin(pets, eq(petEmbeddings.petId, pets.id))
      .where(eq(pets.userId, ctx.session.user.id))
      .orderBy(desc(petEmbeddings.createdAt));
  }),

  findSimilarEmbedding: protectedProcedure
    .input(embeddingMatchInput)
    .query(async ({ ctx, input }) => {
      const distance = cosineDistance(petEmbeddings.embedding, input.values);
      const conditions = [
        eq(pets.userId, ctx.session.user.id),
        eq(petEmbeddings.modelName, input.modelName),
        eq(petEmbeddings.pretrainedWeights, input.pretrainedWeights),
      ];
      if (input.species) {
        conditions.push(eq(pets.species, input.species));
      }

      const embeddingCandidates = await db
        .select({
          petId: pets.id,
          petName: pets.name,
          petSpecies: pets.species,
          embeddingId: petEmbeddings.id,
          similarity: sql<number>`1 - (${distance})`,
        })
        .from(petEmbeddings)
        .innerJoin(pets, eq(petEmbeddings.petId, pets.id))
        .where(and(...conditions))
        .orderBy(distance)
        .limit(MAX_EMBEDDING_CANDIDATES);

      // Um pet pode ter até cinco fotos de referência. Para medir ambiguidade,
      // comparamos o melhor embedding de cada pet, e não duas fotos do mesmo pet.
      const candidatesByPet = new Map<string, (typeof embeddingCandidates)[number]>();
      for (const candidate of embeddingCandidates) {
        if (!candidatesByPet.has(candidate.petId)) {
          candidatesByPet.set(candidate.petId, candidate);
        }
      }
      const [candidate, runnerUp] = [...candidatesByPet.values()];
      const margin =
        candidate && runnerUp
          ? Number((candidate.similarity - runnerUp.similarity).toFixed(4))
          : null;
      const hasSimilarity = Boolean(
        candidate && candidate.similarity >= MINIMUM_EMBEDDING_SIMILARITY,
      );
      const hasSafeMargin =
        margin === null || margin >= MINIMUM_EMBEDDING_MARGIN;
      const match = hasSimilarity && hasSafeMargin ? candidate : null;
      const possibleMatch = hasSimilarity && !hasSafeMargin ? candidate : null;

      return {
        threshold: MINIMUM_EMBEDDING_SIMILARITY,
        marginThreshold: MINIMUM_EMBEDDING_MARGIN,
        margin,
        candidate: candidate ?? null,
        runnerUp: runnerUp ?? null,
        match,
        possibleMatch,
      };
    }),

  recordIdentificationEvent: protectedProcedure
    .input(identificationEventInput)
    .mutation(async ({ ctx, input }) => {
      const [pet] = await db
        .select({ id: pets.id })
        .from(pets)
        .where(
          and(
            eq(pets.id, input.petId),
            eq(pets.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (!pet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pet não encontrado",
        });
      }

      const [event] = await db
        .insert(petEvents)
        .values({
          userId: ctx.session.user.id,
          petId: pet.id,
          eventType: "identification",
          confidence: input.confidence,
          details: input.details,
        })
        .returning({
          id: petEvents.id,
          petId: petEvents.petId,
          eventType: petEvents.eventType,
          confidence: petEvents.confidence,
          createdAt: petEvents.createdAt,
        });

      return event;
    }),

  recordMonitoringEvents: protectedProcedure
    .input(z.object({ events: z.array(monitoringEventInput).min(1).max(25) }))
    .mutation(async ({ ctx, input }) => {
      const petIds = [...new Set(input.events.flatMap((event) => event.petId ? [event.petId] : []))];
      if (petIds.length) {
        const ownedPets = await db.select({ id: pets.id }).from(pets)
          .where(and(eq(pets.userId, ctx.session.user.id), inArray(pets.id, petIds)));
        if (ownedPets.length !== petIds.length) throw new TRPCError({ code: "NOT_FOUND", message: "Pet não encontrado" });
      }
      return db.insert(petEvents).values(input.events.map((event) => ({
        userId: ctx.session.user.id,
        petId: event.petId ?? null,
        eventType: event.eventType,
        confidence: event.confidence ?? null,
        details: event.details,
      }))).returning({ id: petEvents.id, petId: petEvents.petId, eventType: petEvents.eventType, createdAt: petEvents.createdAt });
    }),

  listMonitoringEvents: protectedProcedure
    .input(z.object({ petId: z.string().uuid().optional(), eventTypes: z.array(z.enum(monitoringEventTypes)).max(monitoringEventTypes.length).optional(), limit: z.number().int().min(1).max(100).default(50) }).default({ limit: 50 }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(petEvents.userId, ctx.session.user.id)];
      if (input.petId) conditions.push(eq(petEvents.petId, input.petId));
      if (input.eventTypes?.length) conditions.push(inArray(petEvents.eventType, input.eventTypes));
      return db.select({ id: petEvents.id, petId: petEvents.petId, eventType: petEvents.eventType, confidence: petEvents.confidence, details: petEvents.details, createdAt: petEvents.createdAt })
        .from(petEvents).where(and(...conditions)).orderBy(desc(petEvents.createdAt)).limit(input.limit);
    }),

  update: protectedProcedure
    .input(
      petIdInput.extend({
        data: z
          .object({
            name: petFields.name.optional(),
            species: petFields.species.optional(),
            breed: petFields.breed,
            photoUrl: petFields.photoUrl,
          })
          .refine((data) => Object.keys(data).length > 0, {
            message: "Informe ao menos um campo para atualizar",
          }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [pet] = await db
        .update(pets)
        .set(input.data)
        .where(and(eq(pets.id, input.id), eq(pets.userId, ctx.session.user.id)))
        .returning();

      if (!pet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pet não encontrado",
        });
      }

      return pet;
    }),

  delete: protectedProcedure
    .input(petIdInput)
    .mutation(async ({ ctx, input }) => {
      const [pet] = await db
        .delete(pets)
        .where(and(eq(pets.id, input.id), eq(pets.userId, ctx.session.user.id)))
        .returning({ id: pets.id });

      if (!pet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pet não encontrado",
        });
      }

      return pet;
    }),
});
