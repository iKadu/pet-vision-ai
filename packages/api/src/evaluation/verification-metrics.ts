export type VerificationPair = {
  similarity: number;
  isSamePet: boolean;
};

export type VerificationThresholdPoint = {
  threshold: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  truePositiveRate: number | null;
  falsePositiveRate: number | null;
  precision: number | null;
  recall: number | null;
  specificity: number | null;
};

export type VerificationCurveSummary = {
  totalPairs: number;
  positivePairs: number;
  negativePairs: number;
  rocPoints: VerificationThresholdPoint[];
  precisionRecallPoints: VerificationThresholdPoint[];
  rocAuc: number | null;
  averagePrecision: number | null;
  recommendedThreshold: {
    threshold: number;
    youdenJ: number;
    sensitivity: number;
    specificity: number;
  } | null;
};

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? null : numerator / denominator;
}

function thresholdsFor(pairs: VerificationPair[]) {
  const scores = [...new Set(pairs.map((pair) => pair.similarity))].sort((left, right) => right - left);
  if (scores.length === 0) return [];

  const highest = scores[0]!;
  const lowest = scores.at(-1)!;
  const padding = Math.max(Math.abs(highest - lowest) * 0.000001, 0.000001);
  return [highest + padding, ...scores, lowest - padding];
}

function calculatePoint(
  pairs: VerificationPair[],
  threshold: number,
  positivePairs: number,
  negativePairs: number,
): VerificationThresholdPoint {
  let truePositives = 0;
  let falsePositives = 0;

  for (const pair of pairs) {
    if (pair.similarity < threshold) continue;
    if (pair.isSamePet) truePositives += 1;
    else falsePositives += 1;
  }

  const falseNegatives = positivePairs - truePositives;
  const trueNegatives = negativePairs - falsePositives;
  const predictedPositive = truePositives + falsePositives;

  return {
    threshold,
    truePositives,
    falsePositives,
    trueNegatives,
    falseNegatives,
    truePositiveRate: ratio(truePositives, positivePairs),
    falsePositiveRate: ratio(falsePositives, negativePairs),
    precision: predictedPositive === 0 ? 1 : truePositives / predictedPositive,
    recall: ratio(truePositives, positivePairs),
    specificity: ratio(trueNegatives, negativePairs),
  };
}

function calculateRocAuc(points: VerificationThresholdPoint[]) {
  if (points.some((point) => point.truePositiveRate === null || point.falsePositiveRate === null)) {
    return null;
  }

  return points.slice(1).reduce((area, point, index) => {
    const previous = points[index]!;
    const width = point.falsePositiveRate! - previous.falsePositiveRate!;
    const height = (point.truePositiveRate! + previous.truePositiveRate!) / 2;
    return area + width * height;
  }, 0);
}

function calculateAveragePrecision(points: VerificationThresholdPoint[]) {
  if (points.some((point) => point.recall === null || point.precision === null)) {
    return null;
  }

  return points.slice(1).reduce((area, point, index) => {
    const previous = points[index]!;
    return area + point.precision! * (point.recall! - previous.recall!);
  }, 0);
}

function findRecommendedThreshold(points: VerificationThresholdPoint[]) {
  const candidates = points.slice(1, -1).filter(
    (point) => point.truePositiveRate !== null && point.falsePositiveRate !== null && point.specificity !== null,
  );
  const best = candidates.reduce<VerificationThresholdPoint | null>((current, point) => {
    if (!current) return point;
    const currentYoudenJ = current.truePositiveRate! - current.falsePositiveRate!;
    const pointYoudenJ = point.truePositiveRate! - point.falsePositiveRate!;
    return pointYoudenJ > currentYoudenJ ? point : current;
  }, null);

  if (!best) return null;
  return {
    threshold: best.threshold,
    youdenJ: best.truePositiveRate! - best.falsePositiveRate!,
    sensitivity: best.truePositiveRate!,
    specificity: best.specificity!,
  };
}

export function summarizeVerificationPairs(pairs: VerificationPair[]): VerificationCurveSummary {
  if (pairs.some((pair) => !Number.isFinite(pair.similarity))) {
    throw new Error("A avaliação de verificação recebeu uma similaridade inválida.");
  }

  const positivePairs = pairs.filter((pair) => pair.isSamePet).length;
  const negativePairs = pairs.length - positivePairs;
  const points = thresholdsFor(pairs).map((threshold) =>
    calculatePoint(pairs, threshold, positivePairs, negativePairs),
  );
  const hasBothClasses = positivePairs > 0 && negativePairs > 0;

  return {
    totalPairs: pairs.length,
    positivePairs,
    negativePairs,
    rocPoints: points,
    precisionRecallPoints: points,
    rocAuc: hasBothClasses ? calculateRocAuc(points) : null,
    averagePrecision: hasBothClasses ? calculateAveragePrecision(points) : null,
    recommendedThreshold: hasBothClasses ? findRecommendedThreshold(points) : null,
  };
}
