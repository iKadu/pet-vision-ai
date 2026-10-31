import type { VerificationCurveSummary, VerificationThresholdPoint } from "./verification-metrics";

const WIDTH = 1200;
const HEIGHT = 720;
const PADDING = { top: 218, right: 74, bottom: 106, left: 120 };
const GRID_TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1];

export type VerificationChartMetadata = {
  generatedAt: Date | string;
  subtitle?: string;
};

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  })[character] ?? character);
}

function formatScore(value: number | null) {
  return value === null ? "n/a" : value.toFixed(3).replace(".", ",");
}

function pointFor(
  point: VerificationThresholdPoint,
  x: number | null,
  y: number | null,
) {
  if (x === null || y === null) return null;
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  return {
    x: PADDING.left + x * plotWidth,
    y: PADDING.top + (1 - y) * plotHeight,
    point,
  };
}

function buildPath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

function chartGrid(xLabel: string, yLabel: string) {
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const baseline = PADDING.top + plotHeight;
  const grid = GRID_TICKS.map((tick) => {
    const x = PADDING.left + tick * plotWidth;
    const y = baseline - tick * plotHeight;
    const label = `${Math.round(tick * 100)}%`;
    return `<line x1="${x}" x2="${x}" y1="${PADDING.top}" y2="${baseline}" stroke="#dce7e4" stroke-width="1"/><line x1="${PADDING.left}" x2="${WIDTH - PADDING.right}" y1="${y}" y2="${y}" stroke="#dce7e4" stroke-width="1"/><text x="${x}" y="${baseline + 25}" fill="#63716f" font-size="12" text-anchor="middle">${label}</text><text x="${PADDING.left - 16}" y="${y + 4}" fill="#63716f" font-size="12" text-anchor="end">${label}</text>`;
  }).join("");

  return `<g font-family="Arial, sans-serif">${grid}<line x1="${PADDING.left}" x2="${WIDTH - PADDING.right}" y1="${baseline}" y2="${baseline}" stroke="#475653" stroke-width="1.5"/><line x1="${PADDING.left}" x2="${PADDING.left}" y1="${PADDING.top}" y2="${baseline}" stroke="#475653" stroke-width="1.5"/><text x="${PADDING.left + plotWidth / 2}" y="${HEIGHT - 38}" fill="#334541" font-size="14" font-weight="600" text-anchor="middle">${escapeXml(xLabel)}</text><text x="31" y="${PADDING.top + plotHeight / 2}" fill="#334541" font-size="14" font-weight="600" text-anchor="middle" transform="rotate(-90 31 ${PADDING.top + plotHeight / 2})">${escapeXml(yLabel)}</text></g>`;
}

function metricCard(x: number, label: string, value: string, accent: string) {
  return `<g font-family="Arial, sans-serif"><rect x="${x}" y="108" width="222" height="66" rx="12" fill="#ffffff" stroke="#dce7e4"/><rect x="${x}" y="108" width="4" height="66" rx="2" fill="${accent}"/><text x="${x + 18}" y="132" fill="#63716f" font-size="11" font-weight="700" letter-spacing="1">${escapeXml(label.toUpperCase())}</text><text x="${x + 18}" y="157" fill="#11201d" font-size="22" font-weight="700">${escapeXml(value)}</text></g>`;
}

function findRecommendedPoint(
  points: VerificationThresholdPoint[],
  summary: VerificationCurveSummary,
  x: (point: VerificationThresholdPoint) => number | null,
  y: (point: VerificationThresholdPoint) => number | null,
) {
  if (!summary.recommendedThreshold) return null;
  const point = points.find((candidate) => candidate.threshold === summary.recommendedThreshold!.threshold);
  return point ? pointFor(point, x(point), y(point)) : null;
}

function chartDocument({
  title,
  description,
  summary,
  metadata,
  xLabel,
  yLabel,
  points,
  x,
  y,
  scoreLabel,
  score,
  baseline,
  baselineLabel,
}: {
  title: string;
  description: string;
  summary: VerificationCurveSummary;
  metadata: VerificationChartMetadata;
  xLabel: string;
  yLabel: string;
  points: VerificationThresholdPoint[];
  x: (point: VerificationThresholdPoint) => number | null;
  y: (point: VerificationThresholdPoint) => number | null;
  scoreLabel: string;
  score: number | null;
  baseline?: number;
  baselineLabel?: string;
}) {
  const validPoints = points
    .map((point) => pointFor(point, x(point), y(point)))
    .filter((point): point is NonNullable<typeof point> => point !== null);
  const path = validPoints.length ? `<path d="${buildPath(validPoints)}" fill="none" stroke="#0f766e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` : "";
  const recommended = findRecommendedPoint(points, summary, x, y);
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const baselineY = baseline === undefined ? null : PADDING.top + (1 - baseline) * plotHeight;
  const generatedAt = new Date(metadata.generatedAt).toISOString();
  const subtitle = metadata.subtitle ?? "Avaliação leave-one-out interna com pares de embeddings";
  const insufficientData = validPoints.length === 0;
  const recommendedLabel = recommended
    ? {
      x: recommended.x > WIDTH - PADDING.right - 130 ? recommended.x - 12 : recommended.x + 12,
      textAnchor: recommended.x > WIDTH - PADDING.right - 130 ? "end" : "start",
    }
    : null;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="chart-title chart-description">
  <title id="chart-title">${escapeXml(title)}</title>
  <desc id="chart-description">${escapeXml(description)}</desc>
  <rect width="100%" height="100%" fill="#f8fbfa" rx="24"/>
  <text x="${PADDING.left}" y="48" fill="#11201d" font-family="Arial, sans-serif" font-size="26" font-weight="700">${escapeXml(title)}</text>
  <text x="${PADDING.left}" y="74" fill="#63716f" font-family="Arial, sans-serif" font-size="14">${escapeXml(subtitle)}</text>
  ${metricCard(PADDING.left, scoreLabel, formatScore(score), "#0f766e")}
  ${metricCard(PADDING.left + 242, "Pares positivos", String(summary.positivePairs), "#14b8a6")}
  ${metricCard(PADDING.left + 484, "Pares negativos", String(summary.negativePairs), "#f59e0b")}
  ${metricCard(PADDING.left + 726, "Limiar de Youden", formatScore(summary.recommendedThreshold?.threshold ?? null), "#8b5cf6")}
  ${chartGrid(xLabel, yLabel)}
  ${baselineY === null ? "" : `<line x1="${PADDING.left}" x2="${PADDING.left + plotWidth}" y1="${baselineY}" y2="${baselineY}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="7 7"/><text x="${PADDING.left + plotWidth - 4}" y="${baselineY - 8}" fill="#64748b" font-family="Arial, sans-serif" font-size="11" text-anchor="end">${escapeXml(baselineLabel ?? "Referência")}</text>`}
  ${path}
  ${recommended ? `<circle cx="${recommended.x}" cy="${recommended.y}" r="7" fill="#f59e0b" stroke="#ffffff" stroke-width="3"><title>Limiar de Youden: ${summary.recommendedThreshold!.threshold.toFixed(3)}</title></circle><text x="${recommendedLabel!.x}" y="${recommended.y - 12}" fill="#9a6700" font-family="Arial, sans-serif" font-size="12" font-weight="700" text-anchor="${recommendedLabel!.textAnchor}">Limiar ${summary.recommendedThreshold!.threshold.toFixed(3)}</text>` : ""}
  ${insufficientData ? `<text x="${PADDING.left + plotWidth / 2}" y="${PADDING.top + plotHeight / 2}" fill="#63716f" font-family="Arial, sans-serif" font-size="16" text-anchor="middle">São necessários pares positivos e negativos para traçar esta curva.</text>` : ""}
  <g font-family="Arial, sans-serif" font-size="12"><line x1="${PADDING.left}" x2="${PADDING.left + 28}" y1="${HEIGHT - 78}" y2="${HEIGHT - 78}" stroke="#0f766e" stroke-width="4" stroke-linecap="round"/><text x="${PADDING.left + 38}" y="${HEIGHT - 74}" fill="#475653">Curva observada</text>${recommended ? `<circle cx="${PADDING.left + 196}" cy="${HEIGHT - 78}" r="5" fill="#f59e0b"/><text x="${PADDING.left + 208}" y="${HEIGHT - 74}" fill="#475653">Melhor equilíbrio (Youden)</text>` : ""}</g>
  <text x="${PADDING.left}" y="${HEIGHT - 14}" fill="#63716f" font-family="Arial, sans-serif" font-size="10">Gerado em ${generatedAt} · Dados locais da rodada; não substitui avaliação independente.</text>
</svg>`;
}

export function buildRocChartSvg(summary: VerificationCurveSummary, metadata: VerificationChartMetadata) {
  return chartDocument({
    title: "Curva ROC — identificação individual de cães",
    description: "Taxa de verdadeiros positivos em função da taxa de falsos positivos ao variar o limiar de similaridade.",
    summary,
    metadata,
    xLabel: "Taxa de falsos positivos (1 − especificidade)",
    yLabel: "Taxa de verdadeiros positivos (sensibilidade)",
    points: summary.rocPoints,
    x: (point) => point.falsePositiveRate,
    y: (point) => point.truePositiveRate,
    scoreLabel: "ROC AUC",
    score: summary.rocAuc,
    baseline: undefined,
  });
}

export function buildPrecisionRecallChartSvg(summary: VerificationCurveSummary, metadata: VerificationChartMetadata) {
  const prevalence = summary.totalPairs === 0 ? undefined : summary.positivePairs / summary.totalPairs;
  return chartDocument({
    title: "Curva Precisão–Revocação — identificação individual de cães",
    description: "Precisão em função da revocação ao variar o limiar de similaridade.",
    summary,
    metadata,
    xLabel: "Revocação (sensibilidade)",
    yLabel: "Precisão",
    points: summary.precisionRecallPoints,
    x: (point) => point.recall,
    y: (point) => point.precision,
    scoreLabel: "Precisão-revocação (AP)",
    score: summary.averagePrecision,
    baseline: prevalence,
    baselineLabel: prevalence === undefined ? undefined : `Proporção positiva: ${(prevalence * 100).toFixed(1)}%`,
  });
}
