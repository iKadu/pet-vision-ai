'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BarChart3, Equal, GitCompareArrows, Minus } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';
import { useMemo, useState } from 'react';

import { trpc } from '@/utils/trpc';

function yearRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 365 * 24 * 60 * 60 * 1_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function formatValue(value: number | null, suffix = '', digits = 0) {
  return value === null ? '—' : `${value.toFixed(digits)}${suffix}`;
}

function formatDelta(left: number | null, right: number | null, suffix = '', digits = 0) {
  if (left === null || right === null) return '—';
  const delta = right - left;
  if (delta === 0) return `0${suffix}`;
  return `${delta > 0 ? '+' : ''}${delta.toFixed(digits)}${suffix}`;
}

export default function CompareReportsPage() {
  const range = useMemo(yearRange, []);
  const [leftExperimentId, setLeftExperimentId] = useState('');
  const [rightExperimentId, setRightExperimentId] = useState('');
  const optionsQuery = useQuery(trpc.reports.filterOptions.queryOptions());
  const leftQuery = useQuery({
    ...trpc.reports.overview.queryOptions({ ...range, experimentalSessionId: leftExperimentId || undefined }),
    enabled: Boolean(leftExperimentId),
  });
  const rightQuery = useQuery({
    ...trpc.reports.overview.queryOptions({ ...range, experimentalSessionId: rightExperimentId || undefined }),
    enabled: Boolean(rightExperimentId),
  });

  const leftExperiment = optionsQuery.data?.experimentalSessions.find((session) => session.id === leftExperimentId);
  const rightExperiment = optionsQuery.data?.experimentalSessions.find((session) => session.id === rightExperimentId);
  const left = leftQuery.data?.indicators;
  const right = rightQuery.data?.indicators;
  const isReady = Boolean(leftExperimentId && rightExperimentId && left && right);
  const isLoading = leftQuery.isFetching || rightQuery.isFetching;

  const rows = left && right ? [
    { label: 'Amostras de detecção', left: left.detectionSamples, right: right.detectionSamples },
    { label: 'Trajetórias distintas', left: left.uniqueTracks, right: right.uniqueTracks },
    { label: 'Identificações confirmadas', left: left.confirmedIdentifications, right: right.confirmedIdentifications },
    { label: 'Alertas de ausência', left: left.absenceAlerts, right: right.absenceAlerts },
    { label: 'FPS médio', left: left.averageFps, right: right.averageFps, suffix: ' FPS', digits: 1 },
    { label: 'Latência média do ciclo', left: left.averageCycleLatencyMs, right: right.averageCycleLatencyMs, suffix: ' ms' },
    { label: 'Confiança média da detecção', left: left.averageDetectionConfidence === null ? null : left.averageDetectionConfidence * 100, right: right.averageDetectionConfidence === null ? null : right.averageDetectionConfidence * 100, suffix: ' pp', digits: 1 },
  ] : [];

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-[1120px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
        <Link href={'/dashboard/reports' as Route} className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition hover:text-primary"><ArrowLeft className="h-3.5 w-3.5" />Voltar para relatórios</Link>
        <header className="mt-5 border-b border-border/80 pb-7"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Validação acadêmica</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-foreground sm:text-4xl">Comparar experimentos</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Confronte dois recortes experimentais com os mesmos indicadores operacionais. A diferença apresentada corresponde a B menos A.</p></header>

        <section className="mt-7 rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><GitCompareArrows className="h-5 w-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Seleção de recortes</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Experimento A e B</h2></div></div><div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto_1fr]"><label className="text-xs font-semibold text-foreground">Experimento A<select value={leftExperimentId} onChange={(event) => setLeftExperimentId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"><option value="">Selecione um experimento</option>{optionsQuery.data?.experimentalSessions.filter((session) => session.monitoringSessionId).map((session) => <option key={session.id} value={session.id}>{session.name} · {session.status}</option>)}</select></label><span className="hidden self-end pb-2 text-muted-foreground md:flex"><Equal className="h-5 w-5" /></span><label className="text-xs font-semibold text-foreground">Experimento B<select value={rightExperimentId} onChange={(event) => setRightExperimentId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"><option value="">Selecione um experimento</option>{optionsQuery.data?.experimentalSessions.filter((session) => session.monitoringSessionId && session.id !== leftExperimentId).map((session) => <option key={session.id} value={session.id}>{session.name} · {session.status}</option>)}</select></label></div><p className="mt-4 text-xs leading-5 text-muted-foreground">São exibidos os dados disponíveis nos últimos 365 dias. Cada sessão experimental deve ter uma execução de monitoramento vinculada.</p></section>

        {isLoading && <section className="mt-6 grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />)}</section>}
        {(leftQuery.isError || rightQuery.isError) && <section className="mt-6 rounded-2xl border border-destructive/25 bg-destructive/[0.06] px-5 py-5 text-sm text-destructive">Não foi possível carregar um dos recortes. Verifique se as sessões ainda estão disponíveis e tente novamente.</section>}

        {!isLoading && !isReady && <section className="mt-6 rounded-[28px] border border-dashed border-border bg-card/65 px-5 py-14 text-center"><BarChart3 className="mx-auto h-7 w-7 text-primary" /><h2 className="mt-4 text-lg font-semibold text-card-foreground">Selecione dois experimentos vinculados</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">A comparação usa somente eventos persistidos nas sessões escolhidas. Crie e vincule as sessões na área de Experimentos.</p></section>}

        {isReady && <><section className="mt-6 grid gap-4 md:grid-cols-2"><article className="rounded-[26px] border border-primary/25 bg-accent/45 p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Experimento A</p><h2 className="mt-2 text-lg font-semibold text-card-foreground">{leftExperiment?.name ?? 'Experimento selecionado'}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{leftExperiment?.status ?? '—'} · {leftExperiment?.monitoringSessionId ? 'sessão vinculada' : 'sem sessão'}</p></article><article className="rounded-[26px] border border-info/25 bg-info/[0.06] p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-info">Experimento B</p><h2 className="mt-2 text-lg font-semibold text-card-foreground">{rightExperiment?.name ?? 'Experimento selecionado'}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{rightExperiment?.status ?? '—'} · {rightExperiment?.monitoringSessionId ? 'sessão vinculada' : 'sem sessão'}</p></article></section>
          <section className="mt-6 overflow-hidden rounded-[28px] border border-border/80 bg-card/80 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)]"><div className="border-b border-border/80 px-5 py-5 sm:px-6"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Indicadores observados</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Valores lado a lado</h2></div><div className="overflow-x-auto"><table className="min-w-full text-left"><thead className="bg-surface-raised/65 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3 sm:px-6">Indicador</th><th className="px-5 py-3">A</th><th className="px-5 py-3">B</th><th className="px-5 py-3 sm:pr-6">Diferença B − A</th></tr></thead><tbody className="divide-y divide-border/70">{rows.map((row) => <tr key={row.label}><td className="px-5 py-4 text-sm font-medium text-card-foreground sm:px-6">{row.label}</td><td className="px-5 py-4 font-mono text-sm text-foreground">{formatValue(row.left, row.suffix, row.digits)}</td><td className="px-5 py-4 font-mono text-sm text-foreground">{formatValue(row.right, row.suffix, row.digits)}</td><td className="px-5 py-4 font-mono text-sm text-muted-foreground sm:pr-6">{formatDelta(row.left, row.right, row.suffix, row.digits)}</td></tr>)}</tbody></table></div></section>
          <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />A comparação descreve os dados registrados. A interpretação de variações deve considerar o protocolo, iluminação, distância, cenário e anotações do experimento.</p>
        </>}
      </div>
    </div>
  );
}
