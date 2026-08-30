import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AiWebhookPayload = {
  details?: {
    detections?: unknown[];
  };
};

function hasValidSecret(received: string | null, expected: string | undefined) {
  if (!expected) return true;
  if (!received) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  if (!hasValidSecret(request.headers.get("x-webhook-secret"), process.env.AI_WEBHOOK_SECRET)) {
    return NextResponse.json({ ok: false, error: "Unauthorized webhook" }, { status: 401 });
  }
  try {
    const payload = (await request.json()) as AiWebhookPayload;
    console.info("[AI detection webhook received]", payload);
    return NextResponse.json({
      ok: true,
      receivedAt: new Date().toISOString(),
      totalDetections: payload.details?.detections?.length ?? 0,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }
}
