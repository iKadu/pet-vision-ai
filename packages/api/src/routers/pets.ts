import { db } from "@tccpet/db";
import { pets } from "@tccpet/db/schema/pets";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import z from "zod";

import { protectedProcedure, router } from "../index";

const petIdInput = z.object({
  id: z.string().uuid(),
});

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
