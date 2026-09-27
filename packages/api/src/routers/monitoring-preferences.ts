import { db } from "@tccpet/db";
import { userMonitoringPreferences } from "@tccpet/db/schema/monitoring-preferences";
import { eq } from "drizzle-orm";
import z from "zod";

import { protectedProcedure, router } from "../index";

const defaultPreferences = {
  absenceAlertSeconds: 30,
  notificationCooldownSeconds: 300,
  browserNotificationsEnabled: false,
};

const monitoringPreferencesInput = z.object({
  absenceAlertSeconds: z.number().int().min(5).max(3600),
  notificationCooldownSeconds: z.number().int().min(0).max(86400),
  browserNotificationsEnabled: z.boolean(),
});

export const monitoringPreferencesRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const [preferences] = await db
      .select()
      .from(userMonitoringPreferences)
      .where(eq(userMonitoringPreferences.userId, ctx.session.user.id))
      .limit(1);

    return preferences ?? defaultPreferences;
  }),

  update: protectedProcedure
    .input(monitoringPreferencesInput)
    .mutation(async ({ ctx, input }) => {
      const [preferences] = await db
        .insert(userMonitoringPreferences)
        .values({
          userId: ctx.session.user.id,
          ...input,
        })
        .onConflictDoUpdate({
          target: userMonitoringPreferences.userId,
          set: {
            ...input,
            updatedAt: new Date(),
          },
        })
        .returning();

      return preferences;
    }),
});
