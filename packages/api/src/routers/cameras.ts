import { db } from "@tccpet/db";
import { cameras } from "@tccpet/db/schema/cameras";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import z from "zod";

import { protectedProcedure, router } from "../index";

const cameraIdInput = z.object({
  id: z.string().uuid(),
});

const cameraFields = {
  name: z.string().trim().min(1).max(100),
  type: z.enum(["webcam", "screen", "rtsp"]),
  source: z.string().trim().min(1).max(500),
};

export const camerasRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(cameras)
      .where(eq(cameras.userId, ctx.session.user.id))
      .orderBy(desc(cameras.createdAt));
  }),

  getById: protectedProcedure
    .input(cameraIdInput)
    .query(async ({ ctx, input }) => {
      const [camera] = await db
        .select()
        .from(cameras)
        .where(and(eq(cameras.id, input.id), eq(cameras.userId, ctx.session.user.id)))
        .limit(1);

      if (!camera) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Câmera não encontrada",
        });
      }

      return camera;
    }),

  create: protectedProcedure
    .input(z.object(cameraFields))
    .mutation(async ({ ctx, input }) => {
      const [camera] = await db
        .insert(cameras)
        .values({
          userId: ctx.session.user.id,
          name: input.name,
          type: input.type,
          source: input.source,
        })
        .returning();

      return camera;
    }),

  update: protectedProcedure
    .input(
      cameraIdInput.extend({
        data: z
          .object({
            name: cameraFields.name.optional(),
            type: cameraFields.type.optional(),
            source: cameraFields.source.optional(),
          })
          .refine((data) => Object.keys(data).length > 0, {
            message: "Informe ao menos um campo para atualizar",
          }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [camera] = await db
        .update(cameras)
        .set(input.data)
        .where(and(eq(cameras.id, input.id), eq(cameras.userId, ctx.session.user.id)))
        .returning();

      if (!camera) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Câmera não encontrada",
        });
      }

      return camera;
    }),

  delete: protectedProcedure
    .input(cameraIdInput)
    .mutation(async ({ ctx, input }) => {
      const [camera] = await db
        .delete(cameras)
        .where(and(eq(cameras.id, input.id), eq(cameras.userId, ctx.session.user.id)))
        .returning({ id: cameras.id });

      if (!camera) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Câmera não encontrada",
        });
      }

      return camera;
    }),
});
