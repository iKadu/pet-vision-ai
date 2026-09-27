import { auth } from "@tccpet/auth";
import { db } from "@tccpet/db";
import { userMonitoringPreferences } from "@tccpet/db/schema/monitoring-preferences";
import { eq } from "drizzle-orm";
import { createAiStreamToken } from "@/lib/ai-stream-token";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 });
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
    token: createAiStreamToken(session.user.id),
    monitoring: preferences ?? {
      absenceAlertSeconds: 30,
      notificationCooldownSeconds: 300,
    },
  });
}
