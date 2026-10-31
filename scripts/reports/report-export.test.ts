import assert from "node:assert/strict";
import test from "node:test";

import { buildReportExport, type MonitoringReportExport } from "../../packages/api/src/reporting/report-export";

const report: MonitoringReportExport = {
  range: { from: "2026-10-01T00:00:00.000Z", to: "2026-10-07T23:59:59.999Z" },
  filters: { cameraId: "camera-1" },
  indicators: {
    totalEvents: 12,
    detectionSamples: 8,
    confirmedIdentifications: 2,
    absenceAlerts: 1,
    activityChanges: 1,
    metricsSamples: 4,
    monitoringSessions: 1,
    monitoringDurationSeconds: 300,
    uniqueTracks: 2,
    averageFps: 5,
    averageInferenceLatencyMs: 85.4,
    averageCycleLatencyMs: 190.2,
    averageDetectionConfidence: 0.88,
    identificationStatuses: { identified: 2, confirming: 1, possible: 1, unknown: 4 },
  },
  timeline: [{ day: "2026-10-02", totalEvents: 12, detections: 8, identifications: 2, absenceAlerts: 1 }],
  identificationsByPet: [{ petId: "pet-1", petName: "Mala, \"caramelo\"", total: 2, averageSimilarity: 0.86 }],
  sessions: [{ id: "session-1", status: "completed", startedAt: "2026-10-02T10:00:00.000Z", endedAt: "2026-10-02T10:05:00.000Z", cameraId: "camera-1", cameraName: "Sala", durationSeconds: 300 }],
};

test("gera JSON reprocessável com versão, data e relatório completo", () => {
  const exported = buildReportExport("json", report, new Date("2026-10-08T12:00:00.000Z"));
  const parsed = JSON.parse(exported.content) as { schemaVersion: string; report: MonitoringReportExport };

  assert.equal(exported.fileName, "petvision-relatorio-2026-10-08.json");
  assert.equal(exported.mimeType, "application/json;charset=utf-8");
  assert.equal(parsed.schemaVersion, "petvision.monitoring-report.v1");
  assert.equal(parsed.report.indicators.totalEvents, 12);
});

test("gera CSV UTF-8 com campos escapados e todas as seções auditáveis", () => {
  const exported = buildReportExport("csv", report, new Date("2026-10-08T12:00:00.000Z"));

  assert.equal(exported.fileName, "petvision-relatorio-2026-10-08.csv");
  assert.equal(exported.mimeType, "text/csv;charset=utf-8");
  assert.ok(exported.content.startsWith("\uFEFFseção,chave,valor"));
  assert.match(exported.content, /Mala, ""caramelo""/);
  assert.match(exported.content, /série_diária,detecções,8/);
  assert.match(exported.content, /sessões,duração,300,segundos/);
});
