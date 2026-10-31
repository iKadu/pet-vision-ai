export type MonitoringReportExport = {
  range: { from: string; to: string };
  filters: unknown;
  indicators: {
    totalEvents: number;
    detectionSamples: number;
    confirmedIdentifications: number;
    absenceAlerts: number;
    activityChanges: number;
    metricsSamples: number;
    monitoringSessions: number;
    monitoringDurationSeconds: number;
    uniqueTracks: number;
    averageFps: number | null;
    averageInferenceLatencyMs: number | null;
    averageCycleLatencyMs: number | null;
    averageDetectionConfidence: number | null;
    identificationStatuses: Record<string, number>;
  };
  timeline: Array<{
    day: string;
    totalEvents: number;
    detections: number;
    identifications: number;
    absenceAlerts: number;
  }>;
  identificationsByPet: Array<{
    petId: string;
    petName: string;
    total: number;
    averageSimilarity: number | null;
  }>;
  sessions: Array<{
    id: string;
    status: string;
    startedAt: string | Date;
    endedAt: string | Date | null;
    cameraId: string | null;
    cameraName: string | null;
    durationSeconds: number;
  }>;
};

export type ReportExportFormat = "csv" | "json";

export type ReportExportFile = {
  content: string;
  fileName: string;
  mimeType: string;
};

export function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function createFileName(format: ReportExportFormat, generatedAt: Date) {
  const date = generatedAt.toISOString().slice(0, 10);
  return `petvision-relatorio-${date}.${format}`;
}

export function buildReportExport(
  format: ReportExportFormat,
  report: MonitoringReportExport,
  generatedAt = new Date(),
): ReportExportFile {
  if (format === "json") {
    return {
      content: JSON.stringify(
        {
          schemaVersion: "petvision.monitoring-report.v1",
          generatedAt: generatedAt.toISOString(),
          report,
        },
        null,
        2,
      ),
      fileName: createFileName(format, generatedAt),
      mimeType: "application/json;charset=utf-8",
    };
  }

  const rows: unknown[][] = [
    ["seção", "chave", "valor", "unidade", "data", "animal_id", "animal", "sessão_id", "câmera", "status"],
    ["metadados", "schema_version", "petvision.monitoring-report.v1"],
    ["metadados", "gerado_em", generatedAt.toISOString()],
    ["metadados", "período_inicial", report.range.from],
    ["metadados", "período_final", report.range.to],
    ["metadados", "filtros", JSON.stringify(report.filters)],
  ];

  const indicators = [
    ["eventos_totais", report.indicators.totalEvents, "eventos"],
    ["amostras_detecção", report.indicators.detectionSamples, "amostras"],
    ["identificações_confirmadas", report.indicators.confirmedIdentifications, "eventos"],
    ["alertas_ausência", report.indicators.absenceAlerts, "eventos"],
    ["mudanças_atividade", report.indicators.activityChanges, "eventos"],
    ["amostras_métricas", report.indicators.metricsSamples, "amostras"],
    ["sessões_monitoramento", report.indicators.monitoringSessions, "sessões"],
    ["duração_monitoramento", report.indicators.monitoringDurationSeconds, "segundos"],
    ["trajetórias_distintas", report.indicators.uniqueTracks, "trajetórias"],
    ["fps_médio", report.indicators.averageFps, "fps"],
    ["latência_inferência_média", report.indicators.averageInferenceLatencyMs, "ms"],
    ["latência_ciclo_média", report.indicators.averageCycleLatencyMs, "ms"],
    ["confiança_detecção_média", report.indicators.averageDetectionConfidence, "proporção"],
  ];
  for (const [key, value, unit] of indicators) rows.push(["indicadores", key, value, unit]);
  for (const [status, total] of Object.entries(report.indicators.identificationStatuses)) {
    rows.push(["identificação", status, total, "amostras", undefined, undefined, undefined, undefined, undefined, status]);
  }
  for (const item of report.timeline) {
    rows.push(["série_diária", "eventos", item.totalEvents, "eventos", item.day]);
    rows.push(["série_diária", "detecções", item.detections, "amostras", item.day]);
    rows.push(["série_diária", "identificações", item.identifications, "eventos", item.day]);
    rows.push(["série_diária", "alertas_ausência", item.absenceAlerts, "eventos", item.day]);
  }
  for (const item of report.identificationsByPet) {
    rows.push(["identificações_por_animal", "identificações_confirmadas", item.total, "eventos", undefined, item.petId, item.petName]);
    rows.push(["identificações_por_animal", "similaridade_média", item.averageSimilarity, "proporção", undefined, item.petId, item.petName]);
  }
  for (const session of report.sessions) {
    rows.push(["sessões", "duração", session.durationSeconds, "segundos", new Date(session.startedAt).toISOString(), undefined, undefined, session.id, session.cameraName, session.status]);
  }

  return {
    content: `\uFEFF${rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")}\r\n`,
    fileName: createFileName(format, generatedAt),
    mimeType: "text/csv;charset=utf-8",
  };
}
