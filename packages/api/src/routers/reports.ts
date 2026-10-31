import { db } from "@tccpet/db";
import { cameras } from "@tccpet/db/schema/cameras";
import { experimentalSessions, monitoringSessions } from "@tccpet/db/schema/monitoring-sessions";
import { petEvents, pets } from "@tccpet/db/schema/pets";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import z from "zod";

import { protectedProcedure, router } from "../index";

const monitoringEventTypes = [
  "identification",
  "detection",
  "metrics",
  "activity_changed",
  "pet_left",
] as const;
const identificationStatuses = ["identified", "confirming", "possible", "unknown"] as const;

const reportFiltersShape = {
  cameraId: z.string().uuid().optional(),
  petId: z.string().uuid().optional(),
  monitoringSessionId: z.string().uuid().optional(),
  experimentalSessionId: z.string().uuid().optional(),
  eventTypes: z.array(z.enum(monitoringEventTypes)).min(1).max(monitoringEventTypes.length).optional(),
  identificationStatus: z.enum(identificationStatuses).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
};

const reportFiltersInput = z.object(reportFiltersShape).default({});
const reportEventRecordsInput = z.object({
  ...reportFiltersShape,
  limit: z.number().int().min(1).max(5_000).default(50),
}).default({ limit: 50 });

type ReportFilters = z.infer<typeof reportFiltersInput>;

function reportDateRange(filters: ReportFilters) {
  const end = filters.to ? new Date(filters.to) : new Date();
  const start = filters.from
    ? new Date(filters.from)
    : new Date(end.getTime() - 6 * 24 * 60 * 60 * 1_000);

  if (start > end) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "A data inicial deve ser anterior à data final" });
  }
  if (end.getTime() - start.getTime() > 366 * 24 * 60 * 60 * 1_000) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "O período máximo para um relatório é de 366 dias" });
  }

  return { start, end };
}

function asNumber(value: number | null | undefined) {
  return value === null || value === undefined ? null : Number(value);
}

async function resolveMonitoringSessionId(userId: string, input: ReportFilters) {
  let monitoringSessionId = input.monitoringSessionId;

  if (!input.experimentalSessionId) {
    return { monitoringSessionId, isEmptyExperimentalSession: false };
  }

  const [experimentalSession] = await db
    .select({ monitoringSessionId: experimentalSessions.monitoringSessionId })
    .from(experimentalSessions)
    .where(
      and(
        eq(experimentalSessions.id, input.experimentalSessionId),
        eq(experimentalSessions.userId, userId),
      ),
    )
    .limit(1);

  if (!experimentalSession) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Sessão experimental não encontrada" });
  }
  if (!experimentalSession.monitoringSessionId) {
    return { monitoringSessionId: null, isEmptyExperimentalSession: true };
  }
  if (input.monitoringSessionId && input.monitoringSessionId !== experimentalSession.monitoringSessionId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A sessão experimental selecionada pertence a outra sessão de monitoramento",
    });
  }

  monitoringSessionId = experimentalSession.monitoringSessionId;
  return { monitoringSessionId, isEmptyExperimentalSession: false };
}

export const reportsRouter = router({
  filterOptions: protectedProcedure.query(async ({ ctx }) => {
    const [availableCameras, availablePets, availableSessions, availableExperiments] = await Promise.all([
      db
        .select({ id: cameras.id, name: cameras.name, type: cameras.type })
        .from(cameras)
        .where(eq(cameras.userId, ctx.session.user.id))
        .orderBy(cameras.name),
      db
        .select({ id: pets.id, name: pets.name })
        .from(pets)
        .where(eq(pets.userId, ctx.session.user.id))
        .orderBy(pets.name),
      db
        .select({
          id: monitoringSessions.id,
          status: monitoringSessions.status,
          startedAt: monitoringSessions.startedAt,
          endedAt: monitoringSessions.endedAt,
          cameraName: cameras.name,
        })
        .from(monitoringSessions)
        .leftJoin(cameras, eq(monitoringSessions.cameraId, cameras.id))
        .where(eq(monitoringSessions.userId, ctx.session.user.id))
        .orderBy(desc(monitoringSessions.startedAt))
        .limit(100),
      db
        .select({
          id: experimentalSessions.id,
          name: experimentalSessions.name,
          status: experimentalSessions.status,
          monitoringSessionId: experimentalSessions.monitoringSessionId,
          createdAt: experimentalSessions.createdAt,
        })
        .from(experimentalSessions)
        .where(eq(experimentalSessions.userId, ctx.session.user.id))
        .orderBy(desc(experimentalSessions.createdAt))
        .limit(100),
    ]);

    return {
      cameras: availableCameras,
      pets: availablePets,
      monitoringSessions: availableSessions,
      experimentalSessions: availableExperiments,
      eventTypes: monitoringEventTypes,
      identificationStatuses,
    };
  }),

  overview: protectedProcedure
    .input(reportFiltersInput)
    .query(async ({ ctx, input }) => {
      const { start, end } = reportDateRange(input);
      const resolvedSession = await resolveMonitoringSessionId(ctx.session.user.id, input);
      const resolvedMonitoringSessionId = resolvedSession.monitoringSessionId;

      if (resolvedSession.isEmptyExperimentalSession) {
        return {
          range: { from: start.toISOString(), to: end.toISOString() },
          filters: input,
          indicators: emptyIndicators(),
          timeline: [],
          identificationsByPet: [],
          sessions: [],
        };
      }

      const eventConditions = [
        eq(petEvents.userId, ctx.session.user.id),
        gte(petEvents.createdAt, start),
        lte(petEvents.createdAt, end),
      ];
      if (input.petId) eventConditions.push(eq(petEvents.petId, input.petId));
      if (resolvedMonitoringSessionId) {
        eventConditions.push(eq(petEvents.monitoringSessionId, resolvedMonitoringSessionId));
      }
      if (input.cameraId) eventConditions.push(eq(monitoringSessions.cameraId, input.cameraId));
      if (input.eventTypes?.length) eventConditions.push(inArray(petEvents.eventType, input.eventTypes));
      if (input.identificationStatus) {
        eventConditions.push(
          sql`coalesce(${petEvents.details} -> 'identification' ->> 'status', case when ${petEvents.eventType} = 'identification' then 'identified' end) = ${input.identificationStatus}`,
        );
      }

      const metricsConditions = [...eventConditions, eq(petEvents.eventType, "metrics")];
      const detectionConditions = [...eventConditions, eq(petEvents.eventType, "detection")];
      const identificationConditions = [...eventConditions, eq(petEvents.eventType, "identification")];
      const sessionConditions = [
        eq(monitoringSessions.userId, ctx.session.user.id),
        lte(monitoringSessions.startedAt, end),
        or(
          isNull(monitoringSessions.endedAt),
          gte(monitoringSessions.endedAt, start),
        ),
      ];
      if (input.cameraId) sessionConditions.push(eq(monitoringSessions.cameraId, input.cameraId));
      if (resolvedMonitoringSessionId) sessionConditions.push(eq(monitoringSessions.id, resolvedMonitoringSessionId));

      const [eventsByType, identificationStatusesByCount, performance, detectionQuality, timeline, identificationsByPet, reportSessions] = await Promise.all([
        db
          .select({ eventType: petEvents.eventType, total: count() })
          .from(petEvents)
          .leftJoin(monitoringSessions, eq(petEvents.monitoringSessionId, monitoringSessions.id))
          .where(and(...eventConditions))
          .groupBy(petEvents.eventType),
        db
          .select({
            status: sql<string>`${petEvents.details} -> 'identification' ->> 'status'`,
            total: count(),
          })
          .from(petEvents)
          .leftJoin(monitoringSessions, eq(petEvents.monitoringSessionId, monitoringSessions.id))
          .where(and(...detectionConditions, sql`${petEvents.details} -> 'identification' ->> 'status' is not null`))
          .groupBy(sql`${petEvents.details} -> 'identification' ->> 'status'`),
        db
          .select({
            averageFps: sql<number | null>`avg(nullif(${petEvents.details} ->> 'fps', '')::double precision)`,
            averageInferenceLatencyMs: sql<number | null>`avg(nullif(${petEvents.details} ->> 'inference_latency_ms', '')::double precision)`,
            averageCycleLatencyMs: sql<number | null>`avg(nullif(${petEvents.details} ->> 'cycle_latency_ms', '')::double precision)`,
          })
          .from(petEvents)
          .leftJoin(monitoringSessions, eq(petEvents.monitoringSessionId, monitoringSessions.id))
          .where(and(...metricsConditions)),
        db
          .select({
            averageDetectionConfidence: sql<number | null>`avg(${petEvents.confidence})`,
            uniqueTracks: sql<number>`count(distinct ${petEvents.details} ->> 'trackId')`,
          })
          .from(petEvents)
          .leftJoin(monitoringSessions, eq(petEvents.monitoringSessionId, monitoringSessions.id))
          .where(and(...detectionConditions)),
        db
          .select({
            day: sql<string>`to_char(date_trunc('day', ${petEvents.createdAt}), 'YYYY-MM-DD')`,
            totalEvents: count(),
            detections: sql<number>`count(*) filter (where ${petEvents.eventType} = 'detection')`,
            identifications: sql<number>`count(*) filter (where ${petEvents.eventType} = 'identification')`,
            absenceAlerts: sql<number>`count(*) filter (where ${petEvents.eventType} = 'pet_left')`,
          })
          .from(petEvents)
          .leftJoin(monitoringSessions, eq(petEvents.monitoringSessionId, monitoringSessions.id))
          .where(and(...eventConditions))
          .groupBy(sql`date_trunc('day', ${petEvents.createdAt})`)
          .orderBy(sql`date_trunc('day', ${petEvents.createdAt})`),
        db
          .select({
            petId: pets.id,
            petName: pets.name,
            total: count(),
            averageSimilarity: sql<number | null>`avg(${petEvents.confidence})`,
          })
          .from(petEvents)
          .innerJoin(pets, eq(petEvents.petId, pets.id))
          .leftJoin(monitoringSessions, eq(petEvents.monitoringSessionId, monitoringSessions.id))
          .where(and(...identificationConditions))
          .groupBy(pets.id, pets.name)
          .orderBy(desc(count())),
        db
          .select({
            id: monitoringSessions.id,
            status: monitoringSessions.status,
            startedAt: monitoringSessions.startedAt,
            endedAt: monitoringSessions.endedAt,
            cameraId: monitoringSessions.cameraId,
            cameraName: cameras.name,
          })
          .from(monitoringSessions)
          .leftJoin(cameras, eq(monitoringSessions.cameraId, cameras.id))
          .where(and(...sessionConditions))
          .orderBy(desc(monitoringSessions.startedAt)),
      ]);

      const countsByType = new Map(eventsByType.map((event) => [event.eventType, Number(event.total)]));
      const countsByIdentificationStatus = new Map(
        identificationStatusesByCount.map((item) => [item.status, Number(item.total)]),
      );
      const durationSeconds = reportSessions.reduce((total, session) => {
        const endAt = session.endedAt ?? new Date();
        return total + Math.max(0, (endAt.getTime() - session.startedAt.getTime()) / 1_000);
      }, 0);
      const performanceSummary = performance[0];
      const detectionQualitySummary = detectionQuality[0];

      return {
        range: { from: start.toISOString(), to: end.toISOString() },
        filters: input,
        indicators: {
          totalEvents: monitoringEventTypes.reduce((total, type) => total + (countsByType.get(type) ?? 0), 0),
          detectionSamples: countsByType.get("detection") ?? 0,
          confirmedIdentifications: countsByType.get("identification") ?? 0,
          absenceAlerts: countsByType.get("pet_left") ?? 0,
          activityChanges: countsByType.get("activity_changed") ?? 0,
          metricsSamples: countsByType.get("metrics") ?? 0,
          monitoringSessions: reportSessions.length,
          monitoringDurationSeconds: Math.round(durationSeconds),
          uniqueTracks: Number(detectionQualitySummary?.uniqueTracks ?? 0),
          averageFps: asNumber(performanceSummary?.averageFps),
          averageInferenceLatencyMs: asNumber(performanceSummary?.averageInferenceLatencyMs),
          averageCycleLatencyMs: asNumber(performanceSummary?.averageCycleLatencyMs),
          averageDetectionConfidence: asNumber(detectionQualitySummary?.averageDetectionConfidence),
          identificationStatuses: Object.fromEntries(
            identificationStatuses.map((status) => [status, countsByIdentificationStatus.get(status) ?? 0]),
          ),
        },
        timeline: timeline.map((item) => ({
          day: item.day,
          totalEvents: Number(item.totalEvents),
          detections: Number(item.detections),
          identifications: Number(item.identifications),
          absenceAlerts: Number(item.absenceAlerts),
        })),
        identificationsByPet: identificationsByPet.map((item) => ({
          ...item,
          total: Number(item.total),
          averageSimilarity: asNumber(item.averageSimilarity),
        })),
        sessions: reportSessions.map((session) => ({
          ...session,
          durationSeconds: Math.max(
            0,
            Math.round(((session.endedAt ?? new Date()).getTime() - session.startedAt.getTime()) / 1_000),
          ),
        })),
      };
    }),

  events: protectedProcedure
    .input(reportEventRecordsInput)
    .query(async ({ ctx, input }) => {
      const { start, end } = reportDateRange(input);
      const resolvedSession = await resolveMonitoringSessionId(ctx.session.user.id, input);

      if (resolvedSession.isEmptyExperimentalSession) {
        return [];
      }

      const conditions = [
        eq(petEvents.userId, ctx.session.user.id),
        gte(petEvents.createdAt, start),
        lte(petEvents.createdAt, end),
      ];
      if (input.petId) conditions.push(eq(petEvents.petId, input.petId));
      if (resolvedSession.monitoringSessionId) {
        conditions.push(eq(petEvents.monitoringSessionId, resolvedSession.monitoringSessionId));
      }
      if (input.cameraId) conditions.push(eq(monitoringSessions.cameraId, input.cameraId));
      if (input.eventTypes?.length) conditions.push(inArray(petEvents.eventType, input.eventTypes));
      if (input.identificationStatus) {
        conditions.push(sql`coalesce(${petEvents.details} -> 'identification' ->> 'status', case when ${petEvents.eventType} = 'identification' then 'identified' end) = ${input.identificationStatus}`);
      }

      const events = await db
        .select({
          id: petEvents.id,
          createdAt: petEvents.createdAt,
          eventType: petEvents.eventType,
          confidence: petEvents.confidence,
          petId: petEvents.petId,
          petName: pets.name,
          monitoringSessionId: petEvents.monitoringSessionId,
          cameraId: monitoringSessions.cameraId,
          cameraName: cameras.name,
          trackId: sql<number | null>`nullif(${petEvents.details} ->> 'trackId', '')::integer`,
          identificationStatus: sql<string | null>`coalesce(${petEvents.details} -> 'identification' ->> 'status', case when ${petEvents.eventType} = 'identification' then 'identified' end)`,
          fps: sql<number | null>`nullif(${petEvents.details} ->> 'fps', '')::double precision`,
          inferenceLatencyMs: sql<number | null>`nullif(${petEvents.details} ->> 'inference_latency_ms', '')::double precision`,
          cycleLatencyMs: sql<number | null>`nullif(${petEvents.details} ->> 'cycle_latency_ms', '')::double precision`,
          absenceDurationSeconds: sql<number | null>`nullif(${petEvents.details} ->> 'absentDurationSeconds', '')::double precision`,
          activityState: sql<string | null>`${petEvents.details} -> 'activity' ->> 'state'`,
        })
        .from(petEvents)
        .leftJoin(pets, eq(petEvents.petId, pets.id))
        .leftJoin(monitoringSessions, eq(petEvents.monitoringSessionId, monitoringSessions.id))
        .leftJoin(cameras, eq(monitoringSessions.cameraId, cameras.id))
        .where(and(...conditions))
        .orderBy(desc(petEvents.createdAt))
        .limit(input.limit);

      return events.map((event) => ({
        ...event,
        confidence: asNumber(event.confidence),
        fps: asNumber(event.fps),
        inferenceLatencyMs: asNumber(event.inferenceLatencyMs),
        cycleLatencyMs: asNumber(event.cycleLatencyMs),
        absenceDurationSeconds: asNumber(event.absenceDurationSeconds),
      }));
    }),
});

function emptyIndicators() {
  return {
    totalEvents: 0,
    detectionSamples: 0,
    confirmedIdentifications: 0,
    absenceAlerts: 0,
    activityChanges: 0,
    metricsSamples: 0,
    monitoringSessions: 0,
    monitoringDurationSeconds: 0,
    uniqueTracks: 0,
    averageFps: null,
    averageInferenceLatencyMs: null,
    averageCycleLatencyMs: null,
    averageDetectionConfidence: null,
    identificationStatuses: Object.fromEntries(identificationStatuses.map((status) => [status, 0])),
  };
}
