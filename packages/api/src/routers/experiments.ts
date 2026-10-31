import { db } from "@tccpet/db";
import { cameras } from "@tccpet/db/schema/cameras";
import { experimentalSessions, monitoringSessions } from "@tccpet/db/schema/monitoring-sessions";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import z from "zod";

import { protectedProcedure, router } from "../index";

const experimentStatuses = z.enum(["draft", "ready", "completed", "archived"]);
const monitoringSessionId = z.string().uuid().nullable().optional();

async function assertFinishedMonitoringSession(userId: string, sessionId: string) {
  const [session] = await db
    .select({ id: monitoringSessions.id, status: monitoringSessions.status })
    .from(monitoringSessions)
    .where(and(eq(monitoringSessions.id, sessionId), eq(monitoringSessions.userId, userId)))
    .limit(1);

  if (!session) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Sessão de monitoramento não encontrada" });
  }
  if (session.status === "active") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Encerre o monitoramento antes de vinculá-lo a um experimento",
    });
  }
}

const experimentFields = {
  name: z.string().trim().min(3).max(120),
  objective: z.string().trim().min(3).max(500).nullable().optional(),
  monitoringSessionId,
};

export const experimentsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: experimentalSessions.id,
        name: experimentalSessions.name,
        objective: experimentalSessions.objective,
        status: experimentalSessions.status,
        monitoringSessionId: experimentalSessions.monitoringSessionId,
        startedAt: experimentalSessions.startedAt,
        endedAt: experimentalSessions.endedAt,
        createdAt: experimentalSessions.createdAt,
        cameraName: cameras.name,
        monitoringStatus: monitoringSessions.status,
      })
      .from(experimentalSessions)
      .leftJoin(monitoringSessions, eq(experimentalSessions.monitoringSessionId, monitoringSessions.id))
      .leftJoin(cameras, eq(monitoringSessions.cameraId, cameras.id))
      .where(eq(experimentalSessions.userId, ctx.session.user.id))
      .orderBy(desc(experimentalSessions.createdAt));
  }),

  create: protectedProcedure
    .input(z.object(experimentFields))
    .mutation(async ({ ctx, input }) => {
      if (input.monitoringSessionId) {
        await assertFinishedMonitoringSession(ctx.session.user.id, input.monitoringSessionId);
      }

      const [experiment] = await db
        .insert(experimentalSessions)
        .values({
          userId: ctx.session.user.id,
          name: input.name,
          objective: input.objective ?? null,
          monitoringSessionId: input.monitoringSessionId ?? null,
          status: input.monitoringSessionId ? "ready" : "draft",
        })
        .returning();

      return experiment;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: z
          .object({
            name: experimentFields.name.optional(),
            objective: experimentFields.objective,
            monitoringSessionId,
            status: experimentStatuses.optional(),
          })
          .refine((data) => Object.keys(data).length > 0, {
            message: "Informe ao menos um campo para atualizar",
          }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.data.monitoringSessionId) {
        await assertFinishedMonitoringSession(ctx.session.user.id, input.data.monitoringSessionId);
      }

      const [experiment] = await db
        .update(experimentalSessions)
        .set({ ...input.data, updatedAt: new Date() })
        .where(
          and(
            eq(experimentalSessions.id, input.id),
            eq(experimentalSessions.userId, ctx.session.user.id),
          ),
        )
        .returning();

      if (!experiment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sessão experimental não encontrada" });
      }

      return experiment;
    }),
});
