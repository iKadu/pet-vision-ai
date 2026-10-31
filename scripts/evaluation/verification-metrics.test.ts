import assert from "node:assert/strict";
import test from "node:test";

import { summarizeVerificationPairs } from "./verification-metrics";

test("calcula ROC, AUC, precisão-revocação e limiar pelo índice de Youden", () => {
  const summary = summarizeVerificationPairs([
    { similarity: 0.9, isSamePet: true },
    { similarity: 0.8, isSamePet: true },
    { similarity: 0.7, isSamePet: false },
    { similarity: 0.1, isSamePet: false },
  ]);

  assert.equal(summary.totalPairs, 4);
  assert.equal(summary.positivePairs, 2);
  assert.equal(summary.negativePairs, 2);
  assert.equal(summary.rocAuc, 1);
  assert.equal(summary.averagePrecision, 1);
  assert.deepEqual(summary.recommendedThreshold, {
    threshold: 0.8,
    youdenJ: 1,
    sensitivity: 1,
    specificity: 1,
  });
  assert.ok(summary.rocPoints[0]!.threshold > 0.9);
  assert.equal(summary.rocPoints[0]!.truePositiveRate, 0);
  assert.equal(summary.rocPoints[0]!.falsePositiveRate, 0);
  assert.equal(summary.rocPoints[0]!.specificity, 1);
});

test("não reporta indicadores de separação quando falta uma classe", () => {
  const summary = summarizeVerificationPairs([
    { similarity: 0.9, isSamePet: true },
    { similarity: 0.8, isSamePet: true },
  ]);

  assert.equal(summary.rocAuc, null);
  assert.equal(summary.averagePrecision, null);
  assert.equal(summary.recommendedThreshold, null);
});

test("recusa similaridades não numéricas para preservar a auditabilidade", () => {
  assert.throws(
    () => summarizeVerificationPairs([{ similarity: Number.NaN, isSamePet: true }]),
    /similaridade inválida/,
  );
});
