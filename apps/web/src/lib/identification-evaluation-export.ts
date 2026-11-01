import {
  buildPrecisionRecallChartSvg,
  buildRocChartSvg,
  VERIFICATION_CHART_DIMENSIONS,
} from '@tccpet/api/evaluation/verification-chart-export';

export type IdentificationEvaluationCurvePoint = {
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

export type IdentificationEvaluation = {
  generatedAt: string;
  scope: string;
  inputs: {
    validSamples: number;
    excludedSamples: number;
    pets: number;
    modelNames: string[];
    pretrainedWeights: string[];
    embeddingDimensions: number[];
  };
  configuredThresholds: {
    similarity: number;
    margin: number;
  };
  verification: {
    totalPairs: number;
    positivePairs: number;
    negativePairs: number;
    rocPoints: IdentificationEvaluationCurvePoint[];
    precisionRecallPoints: IdentificationEvaluationCurvePoint[];
    rocAuc: number | null;
    averagePrecision: number | null;
    recommendedThreshold: {
      threshold: number;
      youdenJ: number;
      sensitivity: number;
      specificity: number;
    } | null;
  };
};

export type IdentificationEvaluationExportKind = 'roc-svg' | 'roc-png' | 'precision-recall-svg' | 'precision-recall-png' | 'evaluation-json';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function svgToPngBlob(svg: string) {
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Não foi possível converter o gráfico para PNG.'));
      element.src = url;
    });
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = VERIFICATION_CHART_DIMENSIONS.width * scale;
    canvas.height = VERIFICATION_CHART_DIMENSIONS.height * scale;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('O navegador não disponibilizou a área de exportação.');

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Não foi possível gerar o arquivo PNG.'));
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportIdentificationEvaluation(
  kind: IdentificationEvaluationExportKind,
  evaluation: IdentificationEvaluation,
) {
  const date = new Date(evaluation.generatedAt);
  const dateSuffix = Number.isNaN(date.getTime()) ? 'avaliacao' : date.toISOString().slice(0, 10);
  const metadata = {
    generatedAt: evaluation.generatedAt,
    subtitle: 'Avaliação interna de referências cadastradas',
  };

  if (kind === 'evaluation-json') {
    downloadBlob(
      new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), evaluation }, null, 2)], { type: 'application/json' }),
      `petvision-avaliacao-identificacao-${dateSuffix}.json`,
    );
    return;
  }

  const isRoc = kind.startsWith('roc');
  const svg = isRoc
    ? buildRocChartSvg(evaluation.verification, metadata)
    : buildPrecisionRecallChartSvg(evaluation.verification, metadata);
  const filename = `petvision-${isRoc ? 'curva-roc' : 'curva-precisao-revocacao'}-${dateSuffix}`;

  if (kind.endsWith('svg')) {
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${filename}.svg`);
  } else {
    downloadBlob(await svgToPngBlob(svg), `${filename}.png`);
  }
}
