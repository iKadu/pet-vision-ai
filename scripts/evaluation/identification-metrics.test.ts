import assert from "node:assert/strict";
import test from "node:test";

import {
  getIdentificationDecision,
  summarizeIdentificationEvaluation,
} from "./identification-metrics";

const thresholds = { similarity: 0.75, margin: 0.05 };

test("classifica confirmação, ambiguidade e rejeição pelas regras de produção", () => {
  assert.equal(
    getIdentificationDecision(
      {
        actualPetId: "pet-1",
        actualPetName: "Momo",
        predictedPetId: "pet-1",
        predictedPetName: "Momo",
        topSimilarity: 0.82,
        decisionMargin: 0.08,
      },
      thresholds,
    ),
    "confirmed",
  );
  assert.equal(
    getIdentificationDecision(
      {
        actualPetId: "pet-1",
        actualPetName: "Momo",
        predictedPetId: "pet-2",
        predictedPetName: "Momo2",
        topSimilarity: 0.82,
        decisionMargin: 0.02,
      },
      thresholds,
    ),
    "possible",
  );
  assert.equal(
    getIdentificationDecision(
      {
        actualPetId: "pet-1",
        actualPetName: "Momo",
        predictedPetId: "pet-2",
        predictedPetName: "Momo2",
        topSimilarity: 0.7,
        decisionMargin: 0.12,
      },
      thresholds,
    ),
    "rejected",
  );
});

test("resume acertos, identificações incorretas e a matriz de confusão", () => {
  const summary = summarizeIdentificationEvaluation(
    [
      {
        actualPetId: "pet-1",
        actualPetName: "Momo",
        predictedPetId: "pet-1",
        predictedPetName: "Momo",
        topSimilarity: 0.85,
        decisionMargin: 0.1,
      },
      {
        actualPetId: "pet-1",
        actualPetName: "Momo",
        predictedPetId: "pet-2",
        predictedPetName: "Momo2",
        topSimilarity: 0.84,
        decisionMargin: 0.08,
      },
      {
        actualPetId: "pet-2",
        actualPetName: "Momo2",
        predictedPetId: "pet-2",
        predictedPetName: "Momo2",
        topSimilarity: 0.81,
        decisionMargin: 0.01,
      },
      {
        actualPetId: "pet-2",
        actualPetName: "Momo2",
        predictedPetId: "pet-1",
        predictedPetName: "Momo",
        topSimilarity: 0.68,
        decisionMargin: 0.03,
      },
    ],
    thresholds,
  );

  assert.equal(summary.queries, 4);
  assert.equal(summary.top1Correct, 2);
  assert.equal(summary.confirmedCorrect, 1);
  assert.equal(summary.falseIdentifications, 1);
  assert.equal(summary.ambiguous, 1);
  assert.equal(summary.rejected, 1);
  assert.equal(summary.correctButNotConfirmed, 1);
  assert.deepEqual(summary.confusionMatrix, [
    {
      actualPetId: "pet-1",
      actualPetName: "Momo",
      predictions: [
        { petId: "pet-1", petName: "Momo", count: 1 },
        { petId: "pet-2", petName: "Momo2", count: 1 },
      ],
    },
    {
      actualPetId: "pet-2",
      actualPetName: "Momo2",
      predictions: [
        { petId: "pet-1", petName: "Momo", count: 1 },
        { petId: "pet-2", petName: "Momo2", count: 1 },
      ],
    },
  ]);
});
