import { auth } from "@tccpet/auth";
import { db } from "@tccpet/db";
import { monitoringSessions } from "@tccpet/db/schema/monitoring-sessions";
import { userMonitoringPreferences } from "@tccpet/db/schema/monitoring-preferences";
import { and, eq } from "drizzle-orm";
import { createAiStreamToken } from "@/lib/ai-stream-token";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = z.object({ monitoringSessionId: z.string().uuid() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Sessão de monitoramento inválida" }, { status: 400 });
  }

  const [monitoringSession] = await db
    .select({ id: monitoringSessions.id })
    .from(monitoringSessions)
    .where(
      and(
        eq(monitoringSessions.id, parsed.data.monitoringSessionId),
        eq(monitoringSessions.userId, session.user.id),
        eq(monitoringSessions.status, "active"),
      ),
    )
    .limit(1);

  if (!monitoringSession) {
    return NextResponse.json({ error: "Sessão de monitoramento não encontrada" }, { status: 404 });
  }

  const [preferences] = await db
    .select({
      absenceAlertSeconds: userMonitoringPreferences.absenceAlertSeconds,
      notificationCooldownSeconds:
        userMonitoringPreferences.notificationCooldownSeconds,
    })
    .from(userMonitoringPreferences)
    .where(eq(userMonitoringPreferences.userId, session.user.id))
    .limit(1);

  return NextResponse.json({
    token: createAiStreamToken(session.user.id, monitoringSession.id),
    monitoringSessionId: monitoringSession.id,
    monitoring: preferences ?? {
      absenceAlertSeconds: 30,
      notificationCooldownSeconds: 300,
    },
  });
}
