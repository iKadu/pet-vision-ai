export type IdentificationDecision = "confirmed" | "possible" | "rejected";

export type IdentificationEvaluationResult = {
  actualPetId: string;
  actualPetName: string;
  predictedPetId: string;
  predictedPetName: string;
  topSimilarity: number;
  decisionMargin: number | null;
};

export type IdentificationThresholds = {
  similarity: number;
  margin: number;
};

type ConfusionCell = {
  petId: string;
  petName: string;
  count: number;
};

export type PerPetEvaluation = {
  petId: string;
  petName: string;
  queries: number;
  top1Correct: number;
  confirmedCorrect: number;
  falseIdentifications: number;
  ambiguous: number;
  rejected: number;
};

export type ConfusionMatrixRow = {
  actualPetId: string;
  actualPetName: string;
  predictions: ConfusionCell[];
};

export type IdentificationEvaluationSummary = {
  queries: number;
  top1Correct: number;
  confirmedCorrect: number;
  falseIdentifications: number;
  ambiguous: number;
  rejected: number;
  correctButNotConfirmed: number;
  perPet: PerPetEvaluation[];
  confusionMatrix: ConfusionMatrixRow[];
};

export function getIdentificationDecision(
  result: IdentificationEvaluationResult,
  thresholds: IdentificationThresholds,
): IdentificationDecision {
  if (result.topSimilarity < thresholds.similarity) {
    return "rejected";
  }

  if (
    result.decisionMargin !== null &&
    result.decisionMargin < thresholds.margin
  ) {
    return "possible";
  }

  return "confirmed";
}

export function summarizeIdentificationEvaluation(
  results: IdentificationEvaluationResult[],
  thresholds: IdentificationThresholds,
): IdentificationEvaluationSummary {
  const perPet = new Map<string, PerPetEvaluation>();
  const confusionMatrix = new Map<string, Map<string, ConfusionCell>>();
  let top1Correct = 0;
  let confirmedCorrect = 0;
  let falseIdentifications = 0;
  let ambiguous = 0;
  let rejected = 0;
  let correctButNotConfirmed = 0;

  for (const result of results) {
    const decision = getIdentificationDecision(result, thresholds);
    const isCorrect = result.actualPetId === result.predictedPetId;
    const petMetrics = perPet.get(result.actualPetId) ?? {
      petId: result.actualPetId,
      petName: result.actualPetName,
      queries: 0,
      top1Correct: 0,
      confirmedCorrect: 0,
      falseIdentifications: 0,
      ambiguous: 0,
      rejected: 0,
    };

    petMetrics.queries += 1;
    if (isCorrect) {
      top1Correct += 1;
      petMetrics.top1Correct += 1;
    }

    if (decision === "confirmed" && isCorrect) {
      confirmedCorrect += 1;
      petMetrics.confirmedCorrect += 1;
    }
    if (decision === "confirmed" && !isCorrect) {
      falseIdentifications += 1;
      petMetrics.falseIdentifications += 1;
    }
    if (decision === "possible") {
      ambiguous += 1;
      petMetrics.ambiguous += 1;
    }
    if (decision === "rejected") {
      rejected += 1;
      petMetrics.rejected += 1;
    }
    if (isCorrect && decision !== "confirmed") {
      correctButNotConfirmed += 1;
    }

    perPet.set(result.actualPetId, petMetrics);

    const predictionRow = confusionMatrix.get(result.actualPetId) ?? new Map();
    const currentCell = predictionRow.get(result.predictedPetId) ?? {
      petId: result.predictedPetId,
      petName: result.predictedPetName,
      count: 0,
    };
    currentCell.count += 1;
    predictionRow.set(result.predictedPetId, currentCell);
    confusionMatrix.set(result.actualPetId, predictionRow);
  }

  return {
    queries: results.length,
    top1Correct,
    confirmedCorrect,
    falseIdentifications,
    ambiguous,
    rejected,
    correctButNotConfirmed,
    perPet: [...perPet.values()].sort((left, right) =>
      left.petName.localeCompare(right.petName),
    ),
    confusionMatrix: [...confusionMatrix.entries()]
      .map(([actualPetId, predictions]) => ({
        actualPetId,
        actualPetName: perPet.get(actualPetId)?.petName ?? actualPetId,
        predictions: [...predictions.values()].sort((left, right) =>
          left.petName.localeCompare(right.petName),
        ),
      }))
      .sort((left, right) => left.actualPetName.localeCompare(right.actualPetName)),
  };
}
