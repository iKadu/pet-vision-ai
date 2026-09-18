import { auth } from "@tccpet/auth";
import { createAiStreamToken } from "@/lib/ai-stream-token";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 });
  }

  return NextResponse.json({ token: createAiStreamToken(session.user.id) });
}
