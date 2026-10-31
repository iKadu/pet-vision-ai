import {
  summarizeVerificationPairs,
  type VerificationPair,
} from "./verification-metrics";

export type IdentificationEmbeddingSample = {
  id: string;
  petId: string;
  userId: string;
  petName: string;
  species: string;
  values: number[];
  modelName: string;
  pretrainedWeights: string;
};

function cosineSimilarity(left: number[], right: number[]) {
  return left.reduce((total, value, index) => total + value * right[index]!, 0);
}

export function buildVerificationPairs(samples: IdentificationEmbeddingSample[]): VerificationPair[] {
  const groups = new Map<string, IdentificationEmbeddingSample[]>();
  for (const sample of samples) {
    const key = [
      sample.userId,
      sample.species,
      sample.modelName,
      sample.pretrainedWeights,
      sample.values.length,
    ].join("\u0000");
    const group = groups.get(key) ?? [];
    group.push(sample);
    groups.set(key, group);
  }

  const pairs: VerificationPair[] = [];
  for (const group of groups.values()) {
    for (let queryIndex = 0; queryIndex < group.length; queryIndex += 1) {
      for (let candidateIndex = queryIndex + 1; candidateIndex < group.length; candidateIndex += 1) {
        const query = group[queryIndex]!;
        const candidate = group[candidateIndex]!;
        pairs.push({
          similarity: cosineSimilarity(query.values, candidate.values),
          isSamePet: query.petId === candidate.petId,
        });
      }
    }
  }

  return pairs;
}

export function evaluateIdentificationEmbeddings(rawSamples: IdentificationEmbeddingSample[]) {
  const samples = rawSamples.filter(
    (sample) =>
      sample.values.length > 0 &&
      sample.values.every((value) => Number.isFinite(value)),
  );
  const pairs = buildVerificationPairs(samples);

  return {
    validSamples: samples.length,
    excludedSamples: rawSamples.length - samples.length,
    pets: new Set(samples.map((sample) => sample.petId)).size,
    modelNames: [...new Set(samples.map((sample) => sample.modelName))].sort(),
    pretrainedWeights: [...new Set(samples.map((sample) => sample.pretrainedWeights))].sort(),
    embeddingDimensions: [...new Set(samples.map((sample) => sample.values.length))].sort((left, right) => left - right),
    verification: summarizeVerificationPairs(pairs),
  };
}
