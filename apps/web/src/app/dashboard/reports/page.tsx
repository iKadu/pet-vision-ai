'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  Camera,
  CheckCircle2,
  Clock3,
  Download,
  Filter,
  Gauge,
  RefreshCw,
  ScanLine,
  TriangleAlert,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { trpc } from '@/utils/trpc';
import { buildReportExport, type ReportExportFormat } from '@tccpet/api/reporting/report-export';

const EVENT_TYPES = ['identification', 'detection', 'metrics', 'activity_changed', 'pet_left'] as const;
const IDENTIFICATION_STATUSES = ['identified', 'confirming', 'possible', 'unknown'] as const;

type EventType = (typeof EVENT_TYPES)[number];
type IdentificationStatus = (typeof IDENTIFICATION_STATUSES)[number];

const eventTypeLabels: Record<EventType, string> = {
  identification: 'Identificações confirmadas',
  detection: 'Detecções',
  metrics: 'Métricas de desempenho',
  activity_changed: 'Mudanças de atividade',
  pet_left: 'Alertas de ausência',
};

const identificationLabels: Record<IdentificationStatus, string> = {
  identified: 'Identificado',
  confirming: 'Confirmando',
  possible: 'Possível',
  unknown: 'Não identificado',
};

function initialDateRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1_000);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

function dateStart(value: string) {
  return new Date(`${value}T00:00:00`).toISOString();
}

function dateEnd(value: string) {
  return new Date(`${value}T23:59:59.999`).toISOString();
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)} min`;
  return `${(seconds / 3_600).toFixed(seconds >= 36_000 ? 0 : 1)} h`;
}

function formatMetric(value: number | null, suffix: string, digits = 1) {
  return value === null ? '—' : `${value.toFixed(digits)}${suffix}`;
}

function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function MetricCard({ label, value, detail, icon: Icon, tone = 'primary' }: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Activity;
  tone?: 'primary' | 'success' | 'warning' | 'info';
}) {
  const tones = {
    primary: 'bg-primary/12 text-primary',
    success: 'bg-success/12 text-success',
    warning: 'bg-warning/12 text-warning',
    info: 'bg-info/12 text-info',
  };

  return (
    <article className="rounded-2xl border border-border/80 bg-card/80 p-4 shadow-[0_8px_22px_oklch(0_0_0_/_0.035)] backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-card-foreground">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </article>
  );
}

export default function ReportsPage() {
  const defaultRange = useMemo(initialDateRange, []);
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [cameraId, setCameraId] = useState('');
  const [petId, setPetId] = useState('');
  const [monitoringSessionId, setMonitoringSessionId] = useState('');
  const [experimentalSessionId, setExperimentalSessionId] = useState('');
  const [eventType, setEventType] = useState<EventType | 'all'>('all');
  const [identificationStatus, setIdentificationStatus] = useState<IdentificationStatus | 'all'>('all');

  const filterOptionsQuery = useQuery(trpc.reports.filterOptions.queryOptions());
  const filters = useMemo(() => ({
    from: dateStart(from),
    to: dateEnd(to),
    cameraId: cameraId || undefined,
    petId: petId || undefined,
    monitoringSessionId: monitoringSessionId || undefined,
    experimentalSessionId: experimentalSessionId || undefined,
    eventTypes: eventType === 'all' ? undefined : [eventType],
    identificationStatus: identificationStatus === 'all' ? undefined : identificationStatus,
  }), [cameraId, eventType, experimentalSessionId, from, identificationStatus, monitoringSessionId, petId, to]);
  const overviewQuery = useQuery(trpc.reports.overview.queryOptions(filters));
  const overview = overviewQuery.data;
  const peakTimelineValue = Math.max(
    1,
    ...(overview?.timeline.map((item) => Math.max(item.detections, item.identifications, item.absenceAlerts)) ?? [0]),
  );

  function resetFilters() {
    setFrom(defaultRange.from);
    setTo(defaultRange.to);
    setCameraId('');
    setPetId('');
    setMonitoringSessionId('');
    setExperimentalSessionId('');
    setEventType('all');
    setIdentificationStatus('all');
  }

  function downloadReport(format: ReportExportFormat) {
    if (!overview) return;
    const exported = buildReportExport(format, overview);
    const blob = new Blob([exported.content], { type: exported.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exported.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-[1320px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
        <header className="flex flex-col gap-5 border-b border-border/80 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Observabilidade do monitoramento</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-foreground sm:text-4xl">Relatórios</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Analise as sessões, detecções, identificações e alertas registrados pelo seu monitoramento.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => downloadReport('csv')} disabled={!overview} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground transition hover:border-primary/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-3.5 w-3.5" />CSV</button>
            <button type="button" onClick={() => downloadReport('json')} disabled={!overview} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground transition hover:border-primary/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-3.5 w-3.5" />JSON</button>
            <button type="button" onClick={() => void overviewQuery.refetch()} disabled={overviewQuery.isFetching} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-semibold text-foreground transition hover:border-primary/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${overviewQuery.isFetching ? 'animate-spin' : ''}`} />Atualizar dados</button>
          </div>
        </header>

        <section aria-label="Filtros do relatório" className="mt-6 rounded-[26px] border border-border/80 bg-card/80 p-4 shadow-[0_10px_28px_oklch(0_0_0_/_0.035)] backdrop-blur-sm sm:p-5">
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Filter className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold text-card-foreground">Recorte da análise</h2></div><button type="button" onClick={resetFilters} className="text-xs font-semibold text-primary hover:text-primary-hover">Limpar filtros</button></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-semibold text-foreground">Início<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>
            <label className="text-xs font-semibold text-foreground">Fim<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>
            <label className="text-xs font-semibold text-foreground">Câmera<select value={cameraId} onChange={(event) => setCameraId(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"><option value="">Todas as câmeras</option>{filterOptionsQuery.data?.cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.name}</option>)}</select></label>
            <label className="text-xs font-semibold text-foreground">Animal<select value={petId} onChange={(event) => setPetId(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"><option value="">Todos os animais</option>{filterOptionsQuery.data?.pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}</select></label>
            <label className="text-xs font-semibold text-foreground">Tipo de evento<select value={eventType} onChange={(event) => setEventType(event.target.value as EventType | 'all')} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"><option value="all">Todos os eventos</option>{EVENT_TYPES.map((type) => <option key={type} value={type}>{eventTypeLabels[type]}</option>)}</select></label>
            <label className="text-xs font-semibold text-foreground">Estado da identificação<select value={identificationStatus} onChange={(event) => setIdentificationStatus(event.target.value as IdentificationStatus | 'all')} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"><option value="all">Todos os estados</option>{IDENTIFICATION_STATUSES.map((status) => <option key={status} value={status}>{identificationLabels[status]}</option>)}</select></label>
            <label className="text-xs font-semibold text-foreground">Sessão de monitoramento<select value={monitoringSessionId} onChange={(event) => { setMonitoringSessionId(event.target.value); if (event.target.value) setExperimentalSessionId(''); }} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"><option value="">Todas as sessões</option>{filterOptionsQuery.data?.monitoringSessions.map((session) => <option key={session.id} value={session.id}>{session.cameraName ?? 'Câmera removida'} · {formatDateTime(session.startedAt)}</option>)}</select></label>
            <label className="text-xs font-semibold text-foreground">Sessão experimental<select value={experimentalSessionId} onChange={(event) => { setExperimentalSessionId(event.target.value); if (event.target.value) setMonitoringSessionId(''); }} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"><option value="">Todas as sessões</option>{filterOptionsQuery.data?.experimentalSessions.map((session) => <option key={session.id} value={session.id}>{session.name} · {session.status}</option>)}</select></label>
          </div>
        </section>

        {overviewQuery.isPending && <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl border border-border bg-card" />)}</div>}

        {overviewQuery.isError && <section className="mt-6 rounded-[26px] border border-destructive/25 bg-destructive/[0.06] px-5 py-11 text-center"><TriangleAlert className="mx-auto h-6 w-6 text-destructive" /><h2 className="mt-3 text-lg font-semibold text-foreground">Não foi possível gerar o relatório</h2><p className="mt-2 text-sm text-muted-foreground">Verifique a conexão com o banco e tente novamente.</p><button type="button" onClick={() => void overviewQuery.refetch()} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground"><RefreshCw className="h-3.5 w-3.5" />Tentar novamente</button></section>}

        {overview && <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Amostras de detecção" value={overview.indicators.detectionSamples} detail={`${overview.indicators.uniqueTracks} trajetória(s) distinta(s)`} icon={ScanLine} tone="info" />
            <MetricCard label="Identificações" value={overview.indicators.confirmedIdentifications} detail={`${overview.indicators.identificationStatuses.identified} confirmação(ões) no feed`} icon={CheckCircle2} tone="success" />
            <MetricCard label="Alertas de ausência" value={overview.indicators.absenceAlerts} detail="Presença perdida após a tolerância configurada" icon={TriangleAlert} tone="warning" />
            <MetricCard label="Desempenho médio" value={formatMetric(overview.indicators.averageFps, ' FPS')} detail={`${formatMetric(overview.indicators.averageCycleLatencyMs, ' ms', 0)} por ciclo`} icon={Gauge} />
          </section>

          {overview.indicators.totalEvents === 0 ? <section className="mt-6 rounded-[28px] border border-dashed border-border bg-card/65 px-5 py-14 text-center"><BarChart3 className="mx-auto h-7 w-7 text-primary" /><h2 className="mt-4 text-lg font-semibold text-card-foreground">Ainda não há eventos neste período</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Inicie o monitoramento com uma câmera salva. As detecções, identificações, métricas e alertas aparecerão aqui conforme forem registrados.</p></section> : <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
            <section className="rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6">
              <div className="flex flex-col gap-3 border-b border-border/80 pb-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Série temporal</p><h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Atividade por dia</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Detecções, confirmações e alertas no período selecionado.</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"><Activity className="h-3.5 w-3.5 text-primary" />{overview.indicators.totalEvents} eventos</span></div>
              <div className="mt-6 h-56" role="img" aria-label="Gráfico de barras com a atividade diária do monitoramento">
                <div className="flex h-full items-end gap-2 border-b border-border/80 pb-6">{overview.timeline.map((item) => { const height = Math.round((Math.max(item.detections, item.identifications, item.absenceAlerts) / peakTimelineValue) * 100); return <div key={item.day} className="group relative flex h-full min-w-0 flex-1 items-end justify-center" title={`${item.day}: ${item.detections} detecções, ${item.identifications} identificações e ${item.absenceAlerts} alertas`}><div className="flex h-full w-full max-w-12 items-end gap-0.5"><span className="w-1/2 rounded-t-md bg-primary/75 transition-all group-hover:bg-primary" style={{ height: `${height}%` }} /><span className="w-1/4 rounded-t-md bg-success/75" style={{ height: `${Math.round((item.identifications / peakTimelineValue) * 100)}%` }} /><span className="w-1/4 rounded-t-md bg-warning/80" style={{ height: `${Math.round((item.absenceAlerts / peakTimelineValue) * 100)}%` }} /></div><span className="absolute -bottom-5 left-1/2 max-w-full -translate-x-1/2 truncate text-[9px] text-muted-foreground">{item.day.slice(5).replace('-', '/')}</span></div>; })}</div>
              </div>
              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-primary" />Detecções</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-success" />Identificações</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-warning" />Alertas</span></div>
            </section>

            <aside className="rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Qualidade da identificação</p><h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Leituras no feed</h2><div className="mt-5 space-y-3">{IDENTIFICATION_STATUSES.map((status) => <div key={status} className="flex items-center justify-between gap-3 rounded-xl bg-surface-raised/70 px-3 py-2.5"><span className="text-xs font-medium text-foreground">{identificationLabels[status]}</span><span className="font-mono text-xs font-semibold text-card-foreground">{overview.indicators.identificationStatuses[status]}</span></div>)}</div><div className="mt-6 border-t border-border/80 pt-5"><p className="text-xs font-semibold text-foreground">Confiança média da detecção</p><p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-card-foreground">{formatMetric(overview.indicators.averageDetectionConfidence === null ? null : overview.indicators.averageDetectionConfidence * 100, '%', 0)}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">A confiança do detector não é a certeza da identidade individual.</p></div></aside>
          </div>}

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
            <section className="rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6"><div className="flex items-center justify-between gap-3 border-b border-border/80 pb-5"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Identificações</p><h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Por animal</h2></div><CheckCircle2 className="h-5 w-5 text-success" /></div>{overview.identificationsByPet.length ? <div className="mt-2 divide-y divide-border/70">{overview.identificationsByPet.map((item) => <div key={item.petId} className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-semibold text-card-foreground">{item.petName}</p><p className="mt-1 text-xs text-muted-foreground">Similaridade média: {formatMetric(item.averageSimilarity === null ? null : item.averageSimilarity * 100, '%', 0)}</p></div><span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">{item.total}</span></div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma identificação confirmada com os filtros atuais.</p>}</section>
            <section className="rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6"><div className="flex items-center justify-between gap-3 border-b border-border/80 pb-5"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Execuções</p><h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Sessões monitoradas</h2></div><Clock3 className="h-5 w-5 text-primary" /></div>{overview.sessions.length ? <div className="mt-2 divide-y divide-border/70">{overview.sessions.slice(0, 5).map((session) => <div key={session.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="truncate text-sm font-semibold text-card-foreground">{session.cameraName ?? 'Câmera removida'}</p><p className="mt-1 truncate text-xs text-muted-foreground">{formatDateTime(session.startedAt)} · {formatDuration(session.durationSeconds)}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${session.status === 'completed' ? 'bg-success/10 text-success' : session.status === 'failed' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>{session.status}</span></div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma sessão encontrada no período.</p>}</section>
          </div>

          <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Camera className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />Os relatórios exibem somente eventos persistidos após o início da coleta por sessões. Dados anteriores podem não ter câmera ou sessão associada.</p>
        </>}
      </div>
    </div>
  );
}
