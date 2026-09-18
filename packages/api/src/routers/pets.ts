import { db } from "@tccpet/db";
import { petEmbeddings, petEvents, pets } from "@tccpet/db/schema/pets";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
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
});

const identificationEventInput = z.object({
  petId: z.string().uuid(),
  confidence: z.number().finite().min(0).max(1),
  details: z.object({
    trackId: z.number().int().nonnegative(),
    source: z.string().trim().min(1).max(500),
  }),
});

const MINIMUM_EMBEDDING_SIMILARITY = 0.75;

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

  findSimilarEmbedding: protectedProcedure
    .input(embeddingMatchInput)
    .query(async ({ ctx, input }) => {
      const distance = cosineDistance(petEmbeddings.embedding, input.values);
      const [candidate] = await db
        .select({
          petId: pets.id,
          petName: pets.name,
          petSpecies: pets.species,
          embeddingId: petEmbeddings.id,
          similarity: sql<number>`1 - (${distance})`,
        })
        .from(petEmbeddings)
        .innerJoin(pets, eq(petEmbeddings.petId, pets.id))
        .where(
          and(
            eq(pets.userId, ctx.session.user.id),
            eq(petEmbeddings.modelName, input.modelName),
            eq(petEmbeddings.pretrainedWeights, input.pretrainedWeights),
          ),
        )
        .orderBy(distance)
        .limit(1);

      return {
        threshold: MINIMUM_EMBEDDING_SIMILARITY,
        match:
          candidate && candidate.similarity >= MINIMUM_EMBEDDING_SIMILARITY
            ? candidate
            : null,
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
