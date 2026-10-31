import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEventRecordsCsv,
  type MonitoringEventRecord,
} from '../../packages/api/src/reporting/event-record-export';

const records: MonitoringEventRecord[] = [{
  id: 'event-1',
  createdAt: '2026-10-08T10:15:00.000Z',
  eventType: 'detection',
  confidence: 0.88,
  petId: 'pet-1',
  petName: 'Mala, "caramelo"',
  monitoringSessionId: 'session-1',
  cameraId: 'camera-1',
  cameraName: 'Sala',
  trackId: 12,
  identificationStatus: 'possible',
  fps: 5,
  inferenceLatencyMs: 85.4,
  cycleLatencyMs: 190.2,
  absenceDurationSeconds: null,
  activityState: 'active',
}];

test('gera CSV de eventos com metadados, campos auditáveis e escape seguro', () => {
  const exported = buildEventRecordsCsv(records, new Date('2026-10-08T12:00:00.000Z'));

  assert.equal(exported.fileName, 'petvision-eventos-2026-10-08.csv');
  assert.equal(exported.mimeType, 'text/csv;charset=utf-8');
  assert.ok(exported.content.startsWith('\uFEFFschema_version,gerado_em,evento_id'));
  assert.match(exported.content, /petvision.monitoring-event-records.v1/);
  assert.match(exported.content, /Mala, ""caramelo""/);
  assert.match(exported.content, /detection,session-1,camera-1,Sala,pet-1/);
  assert.doesNotMatch(exported.content, /source|rtsp/i);
});
