import { db } from "@tccpet/db";
import { cameras } from "@tccpet/db/schema/cameras";
import { monitoringSessions } from "@tccpet/db/schema/monitoring-sessions";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import z from "zod";

import { protectedProcedure, router } from "../index";

const sessionEndStatus = z.enum(["completed", "failed", "interrupted"]);

export const monitoringSessionsRouter = router({
  start: protectedProcedure
    .input(z.object({ cameraId: z.string().uuid().nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (input.cameraId) {
        const [camera] = await db
          .select({ id: cameras.id })
          .from(cameras)
          .where(and(eq(cameras.id, input.cameraId), eq(cameras.userId, ctx.session.user.id)))
          .limit(1);

        if (!camera) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Câmera não encontrada" });
        }
      }

      return db.transaction(async (tx) => {
        const now = new Date();

        // O AI Engine atual processa um stream por vez. Ao abrir uma nova sessão
        // do mesmo usuário, encerramos qualquer execução anterior sem encerramento.
        await tx
          .update(monitoringSessions)
          .set({ status: "interrupted", endedAt: now, updatedAt: now })
          .where(
            and(
              eq(monitoringSessions.userId, ctx.session.user.id),
              eq(monitoringSessions.status, "active"),
            ),
          );

        const [monitoringSession] = await tx
          .insert(monitoringSessions)
          .values({
            userId: ctx.session.user.id,
            cameraId: input.cameraId ?? null,
            status: "active",
          })
          .returning();

        return monitoringSession;
      });
    }),

  finishActive: protectedProcedure
    .input(z.object({ status: sessionEndStatus.default("completed") }).default({ status: "completed" }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      return db
        .update(monitoringSessions)
        .set({ status: input.status, endedAt: now, updatedAt: now })
        .where(
          and(
            eq(monitoringSessions.userId, ctx.session.user.id),
            eq(monitoringSessions.status, "active"),
          ),
        )
        .returning({
          id: monitoringSessions.id,
          status: monitoringSessions.status,
          endedAt: monitoringSessions.endedAt,
        });
    }),
});
