import { appRouter } from "@tccpet/api/routers/index";
import { timingSafeEqual } from "node:crypto";
import { getAiStreamTokenUserId } from "@/lib/ai-stream-token";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

type AiWebhookPayload = {
  event_type?: string;
  stream_token?: string;
  source?: string;
  details?: {
    detections?: unknown[];
    identifications?: unknown;
    source?: unknown;
    events?: unknown;
    metrics?: unknown;
  };
};

const normalizedPoint = z.object({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1) });
const trackingDetectionInput = z.object({
  track_id: z.number().int().nonnegative().optional(), confidence: z.number().finite().min(0).max(1),
  bbox: z.object({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1), width: z.number().finite().min(0).max(1), height: z.number().finite().min(0).max(1) }),
  centroid: normalizedPoint,
  activity: z.object({ state: z.enum(["unknown", "active", "resting"]), movement_distance: z.number().finite().nonnegative(), window_seconds: z.number().finite().nonnegative(), samples: z.number().int().nonnegative() }).optional(),
  risk_zones: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(100) })).optional(),
  identification: z.object({ status: z.enum(["identified", "unknown"]), pet_id: z.string().uuid().optional() }).passthrough().optional(),
});
const monitoringEventInput = z.object({ event_type: z.enum(["activity_changed", "zone_entered", "zone_exited"]), track_id: z.number().int().nonnegative(), pet_id: z.string().uuid().optional(), source: z.string().trim().min(1).max(500), centroid: normalizedPoint, activity: z.unknown().optional(), zone: z.unknown().optional() });

const identificationInput = z.object({
  track_id: z.number().int().nonnegative(),
  values: z.array(z.number().finite()).length(512),
  model_name: z.string().trim().min(1).max(150),
  pretrained_weights: z.string().trim().min(1).max(150),
  species: z.enum(["dog", "cat"]).optional(),
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

    const caller = appRouter.createCaller({ auth: null, session: { user: { id: streamUserId } } } as never);

    if (payload.event_type === "pet_monitoring_events") {
      const parsed = z.array(monitoringEventInput).min(1).max(25).safeParse(payload.details?.events);
      if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid monitoring events" }, { status: 400 });
      const events = await caller.pets.recordMonitoringEvents({ events: parsed.data.map((event) => ({ petId: event.pet_id ?? null, eventType: event.event_type, details: { trackId: event.track_id, source: event.source, centroid: event.centroid, activity: event.activity, zone: event.zone } })) });
      return NextResponse.json({ ...response, totalEvents: events.length });
    }

    if (payload.event_type === "pet_tracking_update") {
      const parsed = z.object({ detections: z.array(trackingDetectionInput).min(1).max(24), metrics: z.object({ fps: z.number().finite().nonnegative(), inference_latency_ms: z.number().finite().nonnegative(), cycle_latency_ms: z.number().finite().nonnegative() }).optional() }).safeParse(payload.details);
      if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid tracking update" }, { status: 400 });
      const source = typeof payload.source === "string" ? payload.source.slice(0, 500) : "unknown";
      const events = [
        ...parsed.data.detections.map((detection) => ({ petId: detection.identification?.pet_id ?? null, eventType: "detection" as const, confidence: detection.confidence, details: { trackId: detection.track_id, source, bbox: detection.bbox, centroid: detection.centroid, activity: detection.activity, riskZones: detection.risk_zones ?? [] } })),
        ...(parsed.data.metrics ? [{ eventType: "metrics" as const, details: { source, totalDetections: parsed.data.detections.length, ...parsed.data.metrics } }] : []),
      ];
      const stored = await caller.pets.recordMonitoringEvents({ events });
      return NextResponse.json({ ...response, totalEvents: stored.length });
    }

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

    const matches = await Promise.all(
      parsedIdentifications.data.map(async (identification) => {
        const result = await caller.pets.findSimilarEmbedding({
          values: identification.values,
          modelName: identification.model_name,
          pretrainedWeights: identification.pretrained_weights,
          species: identification.species,
        });

        const attachMargin = <T extends { similarity: number } | null>(candidate: T) =>
          candidate ? { ...candidate, margin: result.margin } : null;

        return {
          track_id: identification.track_id,
          match: attachMargin(result.match),
          possible_match: attachMargin(result.possibleMatch),
        };
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
