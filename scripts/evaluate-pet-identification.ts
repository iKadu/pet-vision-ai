import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "apps/web/.env") });

const [{ db }, { petEmbeddings, pets }, { eq }] = await Promise.all([
  import("@tccpet/db"),
  import("@tccpet/db/schema/pets"),
  import("drizzle-orm"),
]);

type EmbeddingSample = {
  id: string;
  petId: string;
  userId: string;
  species: string;
  values: number[];
  modelName: string;
  pretrainedWeights: string;
};

type EvaluationResult = {
  actualPetId: string;
  predictedPetId: string;
  bestNegativeSimilarity: number | null;
  positiveSimilarity: number;
  topSimilarity: number;
};

function cosineSimilarity(left: number[], right: number[]) {
  return left.reduce((total, value, index) => total + value * right[index]!, 0);
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function formatScore(value: number | null) {
  return value === null ? "n/a" : value.toFixed(3);
}

const requestedUserId = process.argv[2];
const rawSamples = await db
  .select({
    id: petEmbeddings.id,
    petId: petEmbeddings.petId,
    userId: pets.userId,
    species: pets.species,
    values: petEmbeddings.embedding,
    modelName: petEmbeddings.modelName,
    pretrainedWeights: petEmbeddings.pretrainedWeights,
  })
  .from(petEmbeddings)
  .innerJoin(pets, eq(petEmbeddings.petId, pets.id));

const samples = rawSamples.filter(
  (sample): sample is EmbeddingSample =>
    (!requestedUserId || sample.userId === requestedUserId) &&
    Array.isArray(sample.values) &&
    sample.values.length === 512,
);

const results: EvaluationResult[] = [];
let skippedWithoutPair = 0;

for (const query of samples) {
  const gallery = samples.filter(
    (candidate) =>
      candidate.id !== query.id &&
      candidate.userId === query.userId &&
      candidate.species === query.species &&
      candidate.modelName === query.modelName &&
      candidate.pretrainedWeights === query.pretrainedWeights,
  );
  const positives = gallery.filter((candidate) => candidate.petId === query.petId);
  if (positives.length === 0) {
    skippedWithoutPair += 1;
    continue;
  }

  const bestPerPet = new Map<string, number>();
  for (const candidate of gallery) {
    const similarity = cosineSimilarity(query.values, candidate.values);
    const previous = bestPerPet.get(candidate.petId);
    if (previous === undefined || similarity > previous) {
      bestPerPet.set(candidate.petId, similarity);
    }
  }

  const rankedPets = [...bestPerPet.entries()].sort((left, right) => right[1] - left[1]);
  const [predictedPetId, topSimilarity] = rankedPets[0]!;
  const positiveSimilarity = bestPerPet.get(query.petId)!;
  const bestNegativeSimilarity = Math.max(
    ...rankedPets
      .filter(([petId]) => petId !== query.petId)
      .map(([, similarity]) => similarity),
  );

  results.push({
    actualPetId: query.petId,
    predictedPetId,
    positiveSimilarity,
    topSimilarity,
    bestNegativeSimilarity: Number.isFinite(bestNegativeSimilarity)
      ? bestNegativeSimilarity
      : null,
  });
}

const correct = results.filter(
  (result) => result.actualPetId === result.predictedPetId,
);
const positiveScores = results.map((result) => result.positiveSimilarity);
const negativeScores = results
  .map((result) => result.bestNegativeSimilarity)
  .filter((score): score is number => score !== null);
const weakestPositive = positiveScores.length ? Math.min(...positiveScores) : null;
const strongestNegative = negativeScores.length ? Math.max(...negativeScores) : null;

console.log("\nAvaliação leave-one-out de identificação de pets");
console.log(`Amostras válidas: ${samples.length}`);
console.log(`Consultas avaliáveis: ${results.length}`);
console.log(`Consultas sem outra referência do mesmo pet: ${skippedWithoutPair}`);

if (results.length === 0) {
  console.log("\nDados insuficientes para calibrar.");
  console.log("Cadastre pelo menos duas fotos de referência para cada pet a ser avaliado.");
} else {
  console.log(`Top-1 correto: ${((correct.length / results.length) * 100).toFixed(1)}%`);
  console.log(`Similaridade positiva mediana: ${formatScore(median(positiveScores))}`);
  console.log(`Menor similaridade positiva: ${formatScore(weakestPositive)}`);
  console.log(`Maior similaridade negativa: ${formatScore(strongestNegative)}`);

  if (weakestPositive !== null && strongestNegative !== null) {
    if (strongestNegative < weakestPositive) {
      const suggestedThreshold = (strongestNegative + weakestPositive) / 2;
      console.log(`Limiar inicial sugerido: ${suggestedThreshold.toFixed(3)}`);
    } else {
      console.log(
        "Não há separação segura entre pares positivos e negativos. Adicione referências mais variadas antes de reduzir o limiar.",
      );
    }
  } else {
    console.log(
      "Adicione ao menos dois pets da mesma espécie para medir falsos positivos e sugerir um limiar.",
    );
  }
}
