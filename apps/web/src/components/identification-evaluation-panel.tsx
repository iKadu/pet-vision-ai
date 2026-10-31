'use client';

import { BarChart3, BrainCircuit, RefreshCw, TriangleAlert } from 'lucide-react';

type CurvePoint = {
  threshold: number;
  truePositiveRate: number | null;
  falsePositiveRate: number | null;
  precision: number | null;
  recall: number | null;
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
    rocPoints: CurvePoint[];
    precisionRecallPoints: CurvePoint[];
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

function formatScore(value: number | null, digits = 3) {
  return value === null ? '—' : value.toFixed(digits).replace('.', ',');
}

function CurveChart({
  chart,
  points,
  recommendedThreshold,
  baseline,
}: {
  chart: 'roc' | 'precision-recall';
  points: CurvePoint[];
  recommendedThreshold: IdentificationEvaluation['verification']['recommendedThreshold'];
  baseline?: number;
}) {
  const width = 620;
  const height = 390;
  const padding = { top: 34, right: 30, bottom: 64, left: 64 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const title = chart === 'roc' ? 'Curva ROC' : 'Curva Precisão–Revocação';
  const xLabel = chart === 'roc' ? 'Taxa de falsos positivos' : 'Revocação';
  const yLabel = chart === 'roc' ? 'Sensibilidade' : 'Precisão';
  const validPoints = points.flatMap((point) => {
    const xValue = chart === 'roc' ? point.falsePositiveRate : point.recall;
    const yValue = chart === 'roc' ? point.truePositiveRate : point.precision;
    if (xValue === null || yValue === null) return [];
    return [{
      x: padding.left + xValue * plotWidth,
      y: padding.top + (1 - yValue) * plotHeight,
      point,
    }];
  });
  const polyline = validPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const recommended = recommendedThreshold
    ? validPoints.find((point) => point.point.threshold === recommendedThreshold.threshold)
    : undefined;
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <figure className="rounded-2xl border border-border/80 bg-background/60 p-4">
      <figcaption className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-card-foreground">{title}</h3><p className="mt-1 text-xs text-muted-foreground">Limiar de similaridade em cada ponto da curva.</p></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">{chart === 'roc' ? 'AUC' : 'AP'}</span></figcaption>
      <svg data-evaluation-chart={chart} className="mt-4 h-auto w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} da avaliação de identificação`}>
        <rect width={width} height={height} rx="16" fill="currentColor" opacity="0.025" />
        {ticks.map((tick) => {
          const x = padding.left + tick * plotWidth;
          const y = padding.top + (1 - tick) * plotHeight;
          return <g key={tick}><line x1={x} x2={x} y1={padding.top} y2={padding.top + plotHeight} stroke="currentColor" opacity="0.12" /><line x1={padding.left} x2={padding.left + plotWidth} y1={y} y2={y} stroke="currentColor" opacity="0.12" /><text x={x} y={padding.top + plotHeight + 23} fill="currentColor" opacity="0.55" fontSize="10" textAnchor="middle">{Math.round(tick * 100)}%</text><text x={padding.left - 10} y={y + 4} fill="currentColor" opacity="0.55" fontSize="10" textAnchor="end">{Math.round(tick * 100)}%</text></g>;
        })}
        <line x1={padding.left} x2={padding.left + plotWidth} y1={padding.top + plotHeight} y2={padding.top + plotHeight} stroke="currentColor" opacity="0.45" />
        <line x1={padding.left} x2={padding.left} y1={padding.top} y2={padding.top + plotHeight} stroke="currentColor" opacity="0.45" />
        {chart === 'roc' && <line x1={padding.left} x2={padding.left + plotWidth} y1={padding.top + plotHeight} y2={padding.top} stroke="currentColor" opacity="0.25" strokeDasharray="6 6" />}
        {baseline !== undefined && <line x1={padding.left} x2={padding.left + plotWidth} y1={padding.top + (1 - baseline) * plotHeight} y2={padding.top + (1 - baseline) * plotHeight} stroke="currentColor" opacity="0.25" strokeDasharray="6 6" />}
        {polyline && <polyline points={polyline} fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
        {recommended && <g><circle cx={recommended.x} cy={recommended.y} r="7" fill="var(--warning)" stroke="var(--card)" strokeWidth="3" /><title>Limiar de Youden: {recommendedThreshold!.threshold.toFixed(3)}</title></g>}
        <text x={padding.left + plotWidth / 2} y={height - 14} fill="currentColor" opacity="0.7" fontSize="11" fontWeight="600" textAnchor="middle">{xLabel}</text>
        <text x="18" y={padding.top + plotHeight / 2} fill="currentColor" opacity="0.7" fontSize="11" fontWeight="600" textAnchor="middle" transform={`rotate(-90 18 ${padding.top + plotHeight / 2})`}>{yLabel}</text>
      </svg>
    </figure>
  );
}

export function IdentificationEvaluationPanel({
  evaluation,
  isGenerating,
  error,
  onGenerate,
}: {
  evaluation: IdentificationEvaluation | undefined;
  isGenerating: boolean;
  error: string | null;
  onGenerate: () => void;
}) {
  const verification = evaluation?.verification;
  const prevalence = verification && verification.totalPairs > 0
    ? verification.positivePairs / verification.totalPairs
    : undefined;

  return (
    <section className="mt-6 rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6">
      <div className="flex flex-col gap-4 border-b border-border/80 pb-5 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary"><BrainCircuit className="h-5 w-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Validação da identificação</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Separação entre os perfis cadastrados</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Compare as referências visuais do seu cadastro para verificar como a similaridade distingue o mesmo cão de cães diferentes.</p></div></div><button type="button" onClick={onGenerate} disabled={isGenerating} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />{isGenerating ? 'Calculando...' : evaluation ? 'Gerar novamente' : 'Gerar avaliação'}</button></div>
      {error && <div className="mt-5 flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/[0.05] px-4 py-4 text-sm text-destructive"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>{error}</p></div>}
      {!evaluation && !isGenerating && !error && <div className="mt-6 rounded-2xl border border-dashed border-border bg-background/55 px-5 py-10 text-center"><BarChart3 className="mx-auto h-7 w-7 text-primary" /><h3 className="mt-3 text-sm font-semibold text-card-foreground">Avaliação ainda não gerada</h3><p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-muted-foreground">São necessárias ao menos duas referências do mesmo cão e referências de outro cão para calcular ROC, AUC e Precisão–Revocação.</p></div>}
      {isGenerating && !evaluation && <div className="mt-6 grid gap-4 md:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-surface-raised/70" />)}</div>}
      {evaluation && verification && <div className="mt-6"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="ROC AUC" value={formatScore(verification.rocAuc)} detail="Discriminação entre pares" /><Metric label="Precisão–Revocação" value={formatScore(verification.averagePrecision)} detail="AP da classificação binária" /><Metric label="Pares comparados" value={verification.totalPairs} detail={`${verification.positivePairs} positivos · ${verification.negativePairs} negativos`} /><Metric label="Limiar de Youden" value={formatScore(verification.recommendedThreshold?.threshold ?? null)} detail={verification.recommendedThreshold ? `Sensibilidade ${formatScore(verification.recommendedThreshold.sensitivity)} · especificidade ${formatScore(verification.recommendedThreshold.specificity)}` : 'Dados insuficientes'} /></div>
        {verification.rocAuc === null ? <div className="mt-5 rounded-2xl border border-warning/25 bg-warning/[0.07] px-4 py-4 text-sm text-foreground"><p className="font-semibold">Ainda faltam pares comparáveis.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Cadastre referências de pelo menos dois cães, mantendo duas ou mais fotos por perfil.</p></div> : <div className="mt-6 grid gap-5 xl:grid-cols-2"><CurveChart chart="roc" points={verification.rocPoints} recommendedThreshold={verification.recommendedThreshold} /><CurveChart chart="precision-recall" points={verification.precisionRecallPoints} recommendedThreshold={verification.recommendedThreshold} baseline={prevalence} /></div>}
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><span>{evaluation.inputs.validSamples} referências válidas · {evaluation.inputs.pets} perfis</span><span>Modelo: {evaluation.inputs.modelNames.join(', ') || '—'}</span><span>Limiar configurado: {formatScore(evaluation.configuredThresholds.similarity)} · margem {formatScore(evaluation.configuredThresholds.margin)}</span></div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{evaluation.scope} A curva avalia apenas a similaridade visual; a margem de decisão do feed é verificada separadamente.</p>
      </div>}
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <article className="rounded-2xl border border-border/80 bg-background/55 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-card-foreground">{value}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></article>;
}
