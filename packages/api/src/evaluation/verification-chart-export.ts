import type { VerificationCurveSummary, VerificationThresholdPoint } from './verification-metrics';

export const VERIFICATION_CHART_DIMENSIONS = { width: 1200, height: 720 };
const padding = { top: 218, right: 74, bottom: 106, left: 120 };
const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1];

export type VerificationChartMetadata = { generatedAt: Date | string; subtitle?: string };

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] ?? character);
}

function score(value: number | null) {
  return value === null ? 'n/a' : value.toFixed(3).replace('.', ',');
}

function metricCard(x: number, label: string, value: string, color: string) {
  return `<g font-family="Arial, sans-serif"><rect x="${x}" y="108" width="222" height="66" rx="12" fill="#ffffff" stroke="#dce7e4"/><rect x="${x}" y="108" width="4" height="66" rx="2" fill="${color}"/><text x="${x + 18}" y="132" fill="#63716f" font-size="11" font-weight="700" letter-spacing="1">${escapeXml(label.toUpperCase())}</text><text x="${x + 18}" y="157" fill="#11201d" font-size="22" font-weight="700">${escapeXml(value)}</text></g>`;
}

function chartGrid(xLabel: string, yLabel: string) {
  const { width, height } = VERIFICATION_CHART_DIMENSIONS;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const bottom = padding.top + plotHeight;
  const lines = ticks.map((tick) => {
    const x = padding.left + tick * plotWidth;
    const y = bottom - tick * plotHeight;
    const label = `${Math.round(tick * 100)}%`;
    return `<line x1="${x}" x2="${x}" y1="${padding.top}" y2="${bottom}" stroke="#dce7e4"/><line x1="${padding.left}" x2="${width - padding.right}" y1="${y}" y2="${y}" stroke="#dce7e4"/><text x="${x}" y="${bottom + 25}" fill="#63716f" font-size="12" text-anchor="middle">${label}</text><text x="${padding.left - 16}" y="${y + 4}" fill="#63716f" font-size="12" text-anchor="end">${label}</text>`;
  }).join('');
  return `<g font-family="Arial, sans-serif">${lines}<line x1="${padding.left}" x2="${width - padding.right}" y1="${bottom}" y2="${bottom}" stroke="#475653" stroke-width="1.5"/><line x1="${padding.left}" x2="${padding.left}" y1="${padding.top}" y2="${bottom}" stroke="#475653" stroke-width="1.5"/><text x="${padding.left + plotWidth / 2}" y="${height - 38}" fill="#334541" font-size="14" font-weight="600" text-anchor="middle">${escapeXml(xLabel)}</text><text x="31" y="${padding.top + plotHeight / 2}" fill="#334541" font-size="14" font-weight="600" text-anchor="middle" transform="rotate(-90 31 ${padding.top + plotHeight / 2})">${escapeXml(yLabel)}</text></g>`;
}

function pointFor(point: VerificationThresholdPoint, x: number | null, y: number | null) {
  if (x === null || y === null) return null;
  const { width, height } = VERIFICATION_CHART_DIMENSIONS;
  return { x: padding.left + x * (width - padding.left - padding.right), y: padding.top + (1 - y) * (height - padding.top - padding.bottom), point };
}

function buildChart(summary: VerificationCurveSummary, metadata: VerificationChartMetadata, config: {
  title: string; description: string; xLabel: string; yLabel: string; scoreLabel: string; score: number | null;
  points: VerificationThresholdPoint[]; x: (point: VerificationThresholdPoint) => number | null; y: (point: VerificationThresholdPoint) => number | null;
  reference?: 'diagonal' | 'prevalence';
}) {
  const { width, height } = VERIFICATION_CHART_DIMENSIONS;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const rendered = config.points.map((point) => pointFor(point, config.x(point), config.y(point))).filter((point): point is NonNullable<typeof point> => point !== null);
  const path = rendered.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
  const recommended = summary.recommendedThreshold ? rendered.find((point) => point.point.threshold === summary.recommendedThreshold!.threshold) : undefined;
  const prevalence = summary.totalPairs ? summary.positivePairs / summary.totalPairs : null;
  const reference = config.reference === 'diagonal'
    ? `<line x1="${padding.left}" x2="${padding.left + plotWidth}" y1="${padding.top + plotHeight}" y2="${padding.top}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="7 7"/>`
    : config.reference === 'prevalence' && prevalence !== null
      ? `<line x1="${padding.left}" x2="${padding.left + plotWidth}" y1="${padding.top + (1 - prevalence) * plotHeight}" y2="${padding.top + (1 - prevalence) * plotHeight}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="7 7"/><text x="${padding.left + plotWidth - 4}" y="${padding.top + (1 - prevalence) * plotHeight - 8}" fill="#64748b" font-family="Arial, sans-serif" font-size="11" text-anchor="end">Proporção positiva: ${(prevalence * 100).toFixed(1)}%</text>`
      : '';
  const generatedAt = new Date(metadata.generatedAt).toISOString();
  const subtitle = metadata.subtitle ?? 'Avaliação interna com pares de embeddings';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="chart-title chart-description"><title id="chart-title">${escapeXml(config.title)}</title><desc id="chart-description">${escapeXml(config.description)}</desc><rect width="100%" height="100%" fill="#f8fbfa" rx="24"/><text x="${padding.left}" y="48" fill="#11201d" font-family="Arial, sans-serif" font-size="26" font-weight="700">${escapeXml(config.title)}</text><text x="${padding.left}" y="74" fill="#63716f" font-family="Arial, sans-serif" font-size="14">${escapeXml(subtitle)}</text>${metricCard(padding.left, config.scoreLabel, score(config.score), '#0f766e')}${metricCard(padding.left + 242, 'Pares positivos', String(summary.positivePairs), '#14b8a6')}${metricCard(padding.left + 484, 'Pares negativos', String(summary.negativePairs), '#f59e0b')}${metricCard(padding.left + 726, 'Limiar de Youden', score(summary.recommendedThreshold?.threshold ?? null), '#8b5cf6')}${chartGrid(config.xLabel, config.yLabel)}${reference}${path ? `<path d="${path}" fill="none" stroke="#0f766e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` : ''}${recommended ? `<circle cx="${recommended.x}" cy="${recommended.y}" r="7" fill="#f59e0b" stroke="#ffffff" stroke-width="3"/><text x="${recommended.x > width - padding.right - 130 ? recommended.x - 12 : recommended.x + 12}" y="${recommended.y - 12}" fill="#9a6700" font-family="Arial, sans-serif" font-size="12" font-weight="700" text-anchor="${recommended.x > width - padding.right - 130 ? 'end' : 'start'}">Limiar ${summary.recommendedThreshold!.threshold.toFixed(3)}</text>` : ''}${rendered.length === 0 ? `<text x="${padding.left + plotWidth / 2}" y="${padding.top + plotHeight / 2}" fill="#63716f" font-family="Arial, sans-serif" font-size="16" text-anchor="middle">São necessários pares positivos e negativos para traçar esta curva.</text>` : ''}<text x="${padding.left}" y="${height - 14}" fill="#63716f" font-family="Arial, sans-serif" font-size="10">Gerado em ${generatedAt} · Dados locais da rodada; não substitui avaliação independente.</text></svg>`;
}

export function buildRocChartSvg(summary: VerificationCurveSummary, metadata: VerificationChartMetadata) {
  return buildChart(summary, metadata, { title: 'Curva ROC — identificação individual de cães', description: 'Taxa de verdadeiros positivos em função da taxa de falsos positivos.', xLabel: 'Taxa de falsos positivos (1 − especificidade)', yLabel: 'Taxa de verdadeiros positivos (sensibilidade)', scoreLabel: 'ROC AUC', score: summary.rocAuc, points: summary.rocPoints, x: (point) => point.falsePositiveRate, y: (point) => point.truePositiveRate, reference: 'diagonal' });
}

export function buildPrecisionRecallChartSvg(summary: VerificationCurveSummary, metadata: VerificationChartMetadata) {
  return buildChart(summary, metadata, { title: 'Curva Precisão–Revocação — identificação individual de cães', description: 'Precisão em função da revocação ao variar o limiar de similaridade.', xLabel: 'Revocação (sensibilidade)', yLabel: 'Precisão', scoreLabel: 'Precisão-revocação (AP)', score: summary.averagePrecision, points: summary.precisionRecallPoints, x: (point) => point.recall, y: (point) => point.precision, reference: 'prevalence' });
}
