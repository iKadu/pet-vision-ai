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
      .orderBy(desc(cameras.isDefault), desc(cameras.createdAt));
  }),

  getDefault: protectedProcedure.query(async ({ ctx }) => {
    const [camera] = await db
      .select()
      .from(cameras)
      .where(and(eq(cameras.userId, ctx.session.user.id), eq(cameras.isDefault, true)))
      .limit(1);
    return camera ?? null;
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
      return db.transaction(async (tx) => {
        const [existingCamera] = await tx
          .select({ id: cameras.id })
          .from(cameras)
          .where(eq(cameras.userId, ctx.session.user.id))
          .limit(1);
        const [camera] = await tx
          .insert(cameras)
          .values({
            userId: ctx.session.user.id,
            name: input.name,
            type: input.type,
            source: input.source,
            isDefault: !existingCamera,
          })
          .returning();
        return camera;
      });
    }),

  setDefault: protectedProcedure
    .input(cameraIdInput)
    .mutation(async ({ ctx, input }) => {
      return db.transaction(async (tx) => {
        const [camera] = await tx
          .select({ id: cameras.id })
          .from(cameras)
          .where(and(eq(cameras.id, input.id), eq(cameras.userId, ctx.session.user.id)))
          .limit(1);
        if (!camera) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Câmera não encontrada" });
        }

        await tx
          .update(cameras)
          .set({ isDefault: false })
          .where(eq(cameras.userId, ctx.session.user.id));
        const [defaultCamera] = await tx
          .update(cameras)
          .set({ isDefault: true })
          .where(and(eq(cameras.id, camera.id), eq(cameras.userId, ctx.session.user.id)))
          .returning();
        return defaultCamera;
      });
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
      return db.transaction(async (tx) => {
        const [camera] = await tx
          .delete(cameras)
          .where(and(eq(cameras.id, input.id), eq(cameras.userId, ctx.session.user.id)))
          .returning({ id: cameras.id, isDefault: cameras.isDefault });

        if (!camera) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Câmera não encontrada",
          });
        }

        let defaultCameraId: string | null = null;
        if (camera.isDefault) {
          const [fallbackCamera] = await tx
            .select({ id: cameras.id })
            .from(cameras)
            .where(eq(cameras.userId, ctx.session.user.id))
            .orderBy(desc(cameras.createdAt))
            .limit(1);
          if (fallbackCamera) {
            await tx
              .update(cameras)
              .set({ isDefault: true })
              .where(eq(cameras.id, fallbackCamera.id));
            defaultCameraId = fallbackCamera.id;
          }
        }
        return { id: camera.id, defaultCameraId };
      });
    }),
});
