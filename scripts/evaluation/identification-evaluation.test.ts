import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateIdentificationEmbeddings,
  type IdentificationEmbeddingSample,
} from "@tccpet/api/evaluation/identification-evaluation";

function sample(overrides: Partial<IdentificationEmbeddingSample>): IdentificationEmbeddingSample {
  return {
    id: "sample",
    petId: "pet-a",
    userId: "user-a",
    petName: "Mala",
    species: "dog",
    values: [1, 0],
    modelName: "ViT-B-32",
    pretrainedWeights: "laion2b_s34b_b79k",
    ...overrides,
  };
}

test("compara somente referências compatíveis e preserva o isolamento por usuário", () => {
  const evaluation = evaluateIdentificationEmbeddings([
    sample({ id: "a-1", petId: "pet-a", values: [1, 0] }),
    sample({ id: "a-2", petId: "pet-a", values: [0.9, 0.1] }),
    sample({ id: "b-1", petId: "pet-b", petName: "Zoe", values: [0, 1] }),
    sample({ id: "b-2", petId: "pet-b", petName: "Zoe", values: [0.1, 0.9] }),
    sample({ id: "other-user", userId: "user-b", petId: "pet-c", petName: "Vini" }),
    sample({ id: "invalid", values: [Number.NaN, 0] }),
  ]);

  assert.equal(evaluation.validSamples, 5);
  assert.equal(evaluation.excludedSamples, 1);
  assert.equal(evaluation.pets, 3);
  assert.deepEqual(evaluation.embeddingDimensions, [2]);
  assert.equal(evaluation.verification.totalPairs, 6);
  assert.equal(evaluation.verification.positivePairs, 2);
  assert.equal(evaluation.verification.negativePairs, 4);
  assert.equal(evaluation.verification.rocAuc, 1);
});
