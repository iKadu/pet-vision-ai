import assert from "node:assert/strict";
import test from "node:test";

import { buildTimelineChartSvg } from "../../packages/api/src/reporting/timeline-chart-export";

test("gera SVG de atividade diária com valores e rótulos escapados", () => {
  const svg = buildTimelineChartSvg([
    { day: "2026-10-01", detections: 8, identifications: 3, absenceAlerts: 1 },
    { day: "2026-10-02", detections: 4, identifications: 2, absenceAlerts: 0 },
  ]);

  assert.match(svg, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(svg, /Atividade diária do monitoramento/);
  assert.match(svg, /01\/10/);
  assert.match(svg, /#14b8a6/);
  assert.match(svg, /#22c55e/);
  assert.match(svg, /#f59e0b/);
});
