import { protectedProcedure, publicProcedure, router } from "../index";
import { camerasRouter } from "./cameras";
import { monitoringPreferencesRouter } from "./monitoring-preferences";
import { monitoringSessionsRouter } from "./monitoring-sessions";
import { petsRouter } from "./pets";
import { reportsRouter } from "./reports";
import { todoRouter } from "./todo";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  cameras: camerasRouter,
  monitoringPreferences: monitoringPreferencesRouter,
  monitoringSessions: monitoringSessionsRouter,
  pets: petsRouter,
  reports: reportsRouter,
  todo: todoRouter,
});
export type AppRouter = typeof appRouter;
