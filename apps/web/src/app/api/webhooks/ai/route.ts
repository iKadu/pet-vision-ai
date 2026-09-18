import { appRouter } from "@tccpet/api/routers/index";
import { timingSafeEqual } from "node:crypto";
import { getAiStreamTokenUserId } from "@/lib/ai-stream-token";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

type AiWebhookPayload = {
  event_type?: string;
  stream_token?: string;
  details?: {
    detections?: unknown[];
    identifications?: unknown;
    source?: unknown;
  };
};

const identificationInput = z.object({
  track_id: z.number().int().nonnegative(),
  values: z.array(z.number().finite()).length(512),
  model_name: z.string().trim().min(1).max(150),
  pretrained_weights: z.string().trim().min(1).max(150),
});

const identificationEventInput = z.object({
  track_id: z.number().int().nonnegative(),
  match: z.object({
    petId: z.string().uuid(),
    similarity: z.number().finite().min(0).max(1),
  }),
});

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
    const streamUserId =
      typeof payload.stream_token === "string"
        ? getAiStreamTokenUserId(payload.stream_token)
        : null;

    if (!streamUserId) {
      return NextResponse.json({ ok: false, error: "Invalid stream token" }, { status: 401 });
    }

    const response = {
      ok: true,
      receivedAt: new Date().toISOString(),
      streamUserId,
      totalDetections: payload.details?.detections?.length ?? 0,
    };

    if (payload.event_type === "pet_identified") {
      const parsedEvents = z
        .object({
          source: z.string().trim().min(1).max(500),
          identifications: z.array(identificationEventInput).min(1).max(10),
        })
        .safeParse(payload.details);
      if (!parsedEvents.success) {
        return NextResponse.json({ ok: false, error: "Invalid identification event" }, { status: 400 });
      }

      const caller = appRouter.createCaller({
        auth: null,
        session: { user: { id: streamUserId } },
      } as never);
      const events = await Promise.all(
        parsedEvents.data.identifications.map(({ track_id, match }) =>
          caller.pets.recordIdentificationEvent({
            petId: match.petId,
            confidence: match.similarity,
            details: { trackId: track_id, source: parsedEvents.data.source },
          }),
        ),
      );

      console.info("[AI identification events recorded]", {
        streamUserId,
        totalEvents: events.length,
      });
      return NextResponse.json({ ...response, totalEvents: events.length });
    }

    if (payload.event_type !== "pet_identification") {
      console.info("[AI detection webhook received]", {
        eventType: payload.event_type,
        streamUserId,
        totalDetections: response.totalDetections,
      });
      return NextResponse.json(response);
    }

    const parsedIdentifications = z
      .array(identificationInput)
      .min(1)
      .max(10)
      .safeParse(payload.details?.identifications);
    if (!parsedIdentifications.success) {
      return NextResponse.json({ ok: false, error: "Invalid identification payload" }, { status: 400 });
    }

    const caller = appRouter.createCaller({
      auth: null,
      session: { user: { id: streamUserId } },
    } as never);
    const matches = await Promise.all(
      parsedIdentifications.data.map(async (identification) => {
        const result = await caller.pets.findSimilarEmbedding({
          values: identification.values,
          modelName: identification.model_name,
          pretrainedWeights: identification.pretrained_weights,
        });

        return { track_id: identification.track_id, match: result.match };
      }),
    );

    console.info("[AI identification webhook processed]", {
      streamUserId,
      totalTracks: matches.length,
      identifiedTracks: matches.filter(({ match }) => match !== null).length,
    });
    return NextResponse.json({ ...response, matches });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }
}
