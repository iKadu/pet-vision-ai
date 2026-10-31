import assert from "node:assert/strict";
import test from "node:test";

import { buildPrecisionRecallChartSvg, buildRocChartSvg } from "./verification-chart-export";
import { summarizeVerificationPairs } from "./verification-metrics";

const summary = summarizeVerificationPairs([
  { similarity: 0.9, isSamePet: true },
  { similarity: 0.8, isSamePet: true },
  { similarity: 0.7, isSamePet: false },
  { similarity: 0.1, isSamePet: false },
]);
const metadata = { generatedAt: "2026-10-31T12:00:00.000Z" };

test("gera curva ROC auditável com AUC, eixos e limiar destacado", () => {
  const svg = buildRocChartSvg(summary, metadata);

  assert.match(svg, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(svg, /Curva ROC — identificação individual de cães/);
  assert.match(svg, /ROC AUC/);
  assert.match(svg, /1,000/);
  assert.match(svg, /Taxa de falsos positivos/);
  assert.match(svg, /Limiar 0\.800/);
});

test("gera curva Precisão–Revocação com a linha de prevalência", () => {
  const svg = buildPrecisionRecallChartSvg(summary, metadata);

  assert.match(svg, /Curva Precisão–Revocação/);
  assert.match(svg, /PRECISÃO-REVOCAÇÃO \(AP\)/);
  assert.match(svg, /Proporção positiva: 50\.0%/);
  assert.match(svg, /Revocação/);
});
