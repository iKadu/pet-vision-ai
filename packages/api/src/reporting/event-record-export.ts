import { escapeCsv } from './report-export';

export type MonitoringEventRecord = {
  id: string;
  createdAt: Date | string;
  eventType: string;
  confidence: number | null;
  petId: string | null;
  petName: string | null;
  monitoringSessionId: string | null;
  cameraId: string | null;
  cameraName: string | null;
  trackId: number | null;
  identificationStatus: string | null;
  fps: number | null;
  inferenceLatencyMs: number | null;
  cycleLatencyMs: number | null;
  absenceDurationSeconds: number | null;
  activityState: string | null;
};

export type EventRecordsExportFile = {
  content: string;
  fileName: string;
  mimeType: string;
};

function createFileName(generatedAt: Date) {
  return `petvision-eventos-${generatedAt.toISOString().slice(0, 10)}.csv`;
}

export function buildEventRecordsCsv(
  records: MonitoringEventRecord[],
  generatedAt = new Date(),
): EventRecordsExportFile {
  const rows: unknown[][] = [
    [
      'schema_version',
      'gerado_em',
      'evento_id',
      'registrado_em',
      'tipo_evento',
      'sessão_monitoramento_id',
      'câmera_id',
      'câmera',
      'animal_id',
      'animal',
      'track_id',
      'estado_identificação',
      'confiança_ou_similaridade',
      'fps',
      'latência_inferência_ms',
      'latência_ciclo_ms',
      'ausência_segundos',
      'estado_atividade',
    ],
    ...records.map((record) => [
      'petvision.monitoring-event-records.v1',
      generatedAt.toISOString(),
      record.id,
      new Date(record.createdAt).toISOString(),
      record.eventType,
      record.monitoringSessionId,
      record.cameraId,
      record.cameraName,
      record.petId,
      record.petName,
      record.trackId,
      record.identificationStatus,
      record.confidence,
      record.fps,
      record.inferenceLatencyMs,
      record.cycleLatencyMs,
      record.absenceDurationSeconds,
      record.activityState,
    ]),
  ];

  return {
    content: `\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')}\r\n`,
    fileName: createFileName(generatedAt),
    mimeType: 'text/csv;charset=utf-8',
  };
}
