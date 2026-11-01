'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, Filter, ListTree, RefreshCw, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ReportExportDialog, type ReportExportKind } from '@/components/report-export-dialog';
import { ReportSectionNav } from '@/components/report-section-nav';
import { trpc } from '@/utils/trpc';
import { buildEventRecordsCsv } from '@tccpet/api/reporting/event-record-export';

const EVENT_TYPES = ['identification', 'detection', 'metrics', 'activity_changed', 'pet_left'] as const;
const IDENTIFICATION_STATUSES = ['identified', 'confirming', 'possible', 'unknown'] as const;
const EVENTS_PER_PAGE = 15;

type EventType = (typeof EVENT_TYPES)[number];
type IdentificationStatus = (typeof IDENTIFICATION_STATUSES)[number];

const eventTypeLabels: Record<EventType, string> = {
  identification: 'Identificação confirmada',
  detection: 'Detecção',
  metrics: 'Métrica operacional',
  activity_changed: 'Mudança de atividade',
  pet_left: 'Alerta de ausência',
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
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

function dateStart(value: string) {
  return new Date(`${value}T00:00:00`).toISOString();
}

function dateEnd(value: string) {
  return new Date(`${value}T23:59:59.999`).toISOString();
}

function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function formatMetric(value: number | null, suffix: string, digits = 1) {
  return value === null ? '—' : `${value.toFixed(digits)}${suffix}`;
}

function eventTone(type: string) {
  if (type === 'identification') return 'bg-success/10 text-success';
  if (type === 'pet_left') return 'bg-warning/10 text-warning';
  if (type === 'metrics') return 'bg-info/10 text-info';
  return 'bg-surface-raised text-foreground';
}

function EventDetails({ event }: { event: {
  trackId: number | null;
  confidence: number | null;
  fps: number | null;
  inferenceLatencyMs: number | null;
  cycleLatencyMs: number | null;
  absenceDurationSeconds: number | null;
  activityState: string | null;
  monitoringSessionId: string | null;
} }) {
  const details = [
    ['Trajetória', event.trackId === null ? null : String(event.trackId)],
    ['Confiança', event.confidence === null ? null : formatMetric(event.confidence * 100, '%', 0)],
    ['Desempenho', event.fps === null ? null : formatMetric(event.fps, ' FPS')],
    ['Inferência', event.inferenceLatencyMs === null ? null : formatMetric(event.inferenceLatencyMs, ' ms', 0)],
    ['Ciclo', event.cycleLatencyMs === null ? null : formatMetric(event.cycleLatencyMs, ' ms', 0)],
    ['Ausência', event.absenceDurationSeconds === null ? null : `${formatMetric(event.absenceDurationSeconds, ' s', 0)} ausente`],
    ['Atividade', event.activityState],
    ['Sessão', event.monitoringSessionId],
  ].filter((item): item is [string, string] => item[1] !== null);

  if (!details.length) return <p className="mt-3 text-xs text-muted-foreground">Não há detalhes adicionais neste registro.</p>;

  return <dl className="mt-3 grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2">
    {details.map(([label, value]) => <div key={label} className="flex items-baseline justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="truncate font-medium text-card-foreground" title={value}>{value}</dd></div>)}
  </dl>;
}

export default function ReportEventsPage() {
  const defaultRange = useMemo(initialDateRange, []);
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [cameraId, setCameraId] = useState('');
  const [petId, setPetId] = useState('');
  const [monitoringSessionId, setMonitoringSessionId] = useState('');
  const [experimentalSessionId, setExperimentalSessionId] = useState('');
  const [eventType, setEventType] = useState<EventType | 'all'>('all');
  const [identificationStatus, setIdentificationStatus] = useState<IdentificationStatus | 'all'>('all');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [sortDescending, setSortDescending] = useState(true);
  const [page, setPage] = useState(1);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

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
  const eventsQuery = useQuery(trpc.reports.events.queryOptions({ ...filters, limit: 5_000 }));

  const records = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
    const filtered = (eventsQuery.data ?? []).filter((event) => {
      if (!normalizedSearch) return true;
      return [
        event.petName,
        event.cameraName,
        eventTypeLabels[event.eventType as EventType] ?? event.eventType,
        event.identificationStatus ? identificationLabels[event.identificationStatus as IdentificationStatus] ?? event.identificationStatus : '',
      ].some((value) => value?.toLocaleLowerCase('pt-BR').includes(normalizedSearch));
    });
    return [...filtered].sort((left, right) => {
      const difference = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      return sortDescending ? -difference : difference;
    });
  }, [eventsQuery.data, search, sortDescending]);
  const totalPages = Math.max(1, Math.ceil(records.length / EVENTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const currentRecords = records.slice((currentPage - 1) * EVENTS_PER_PAGE, currentPage * EVENTS_PER_PAGE);

  useEffect(() => setPage(1), [cameraId, eventType, experimentalSessionId, from, identificationStatus, monitoringSessionId, petId, search, sortDescending, to]);

  function resetFilters() {
    setFrom(defaultRange.from);
    setTo(defaultRange.to);
    setCameraId('');
    setPetId('');
    setMonitoringSessionId('');
    setExperimentalSessionId('');
    setEventType('all');
    setIdentificationStatus('all');
    setSearch('');
  }

  async function handleExport(kind: ReportExportKind) {
    if (kind !== 'events-csv' || !eventsQuery.data || isExporting) return;
    setExportError(null);
    setIsExporting(true);
    try {
      const exported = buildEventRecordsCsv(eventsQuery.data);
      const blob = new Blob([exported.content], { type: exported.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = exported.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setIsExportDialogOpen(false);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Não foi possível exportar os eventos.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
        <header className="flex flex-col gap-5 border-b border-border/80 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.045em] text-foreground sm:text-4xl">Eventos</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Consulte os registros detalhados do monitoramento.</p>
          </div>
          <button type="button" onClick={() => setIsExportDialogOpen(true)} disabled={!eventsQuery.isSuccess} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-3.5 w-3.5" />Exportar eventos</button>
        </header>
        <ReportSectionNav active="events" />

        <section aria-label="Filtros dos eventos" className="mt-6 rounded-[26px] border border-border/80 bg-card/80 p-4 shadow-[0_10px_28px_oklch(0_0_0_/_0.035)] backdrop-blur-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Filter className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold text-card-foreground">Filtros</h2></div><div className="flex items-center gap-3"><button type="button" onClick={() => setShowMoreFilters((current) => !current)} aria-expanded={showMoreFilters} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-primary"><SlidersHorizontal className="h-3.5 w-3.5" />Mais filtros</button><button type="button" onClick={resetFilters} className="text-xs font-semibold text-primary hover:text-primary-hover">Limpar</button></div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-semibold text-foreground">Início<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>
            <label className="text-xs font-semibold text-foreground">Fim<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>
            <label className="text-xs font-semibold text-foreground">Câmera<select value={cameraId} onChange={(event) => setCameraId(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"><option value="">Todas as câmeras</option>{filterOptionsQuery.data?.cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.name}</option>)}</select></label>
            <label className="text-xs font-semibold text-foreground">Buscar<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Animal, câmera ou evento" className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-normal text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>
          </div>
          {showMoreFilters && <div className="mt-3 grid gap-3 border-t border-border/70 pt-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="text-xs font-semibold text-foreground">Animal<select value={petId} onChange={(event) => setPetId(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"><option value="">Todos os animais</option>{filterOptionsQuery.data?.pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}</select></label>
            <label className="text-xs font-semibold text-foreground">Tipo de evento<select value={eventType} onChange={(event) => setEventType(event.target.value as EventType | 'all')} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"><option value="all">Todos os eventos</option>{EVENT_TYPES.map((type) => <option key={type} value={type}>{eventTypeLabels[type]}</option>)}</select></label>
            <label className="text-xs font-semibold text-foreground">Estado da identificação<select value={identificationStatus} onChange={(event) => setIdentificationStatus(event.target.value as IdentificationStatus | 'all')} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"><option value="all">Todos os estados</option>{IDENTIFICATION_STATUSES.map((status) => <option key={status} value={status}>{identificationLabels[status]}</option>)}</select></label>
            <label className="text-xs font-semibold text-foreground">Sessão de monitoramento<select value={monitoringSessionId} onChange={(event) => { setMonitoringSessionId(event.target.value); if (event.target.value) setExperimentalSessionId(''); }} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"><option value="">Todas as sessões</option>{filterOptionsQuery.data?.monitoringSessions.map((session) => <option key={session.id} value={session.id}>{session.cameraName ?? 'Câmera removida'} · {formatDateTime(session.startedAt)}</option>)}</select></label>
            <label className="text-xs font-semibold text-foreground">Sessão experimental<select value={experimentalSessionId} onChange={(event) => { setExperimentalSessionId(event.target.value); if (event.target.value) setMonitoringSessionId(''); }} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"><option value="">Todas as sessões</option>{filterOptionsQuery.data?.experimentalSessions.map((session) => <option key={session.id} value={session.id}>{session.name} · {session.status}</option>)}</select></label>
          </div>}
        </section>

        <section className="mt-6 rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6">
          <div className="flex flex-col gap-4 border-b border-border/80 pb-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold tracking-[-0.03em] text-card-foreground">Histórico de eventos</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{records.length ? `${records.length} registro(s) no recorte atual` : 'Eventos persistidos pelas sessões de monitoramento.'} · até 5.000 registros por consulta.</p></div><button type="button" onClick={() => setSortDescending((current) => !current)} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:border-primary/35 hover:text-primary">{sortDescending ? 'Mais recentes primeiro' : 'Mais antigos primeiro'}</button></div>

          {eventsQuery.isPending && <div className="mt-5 flex min-h-44 items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin text-primary" aria-label="Carregando eventos" /></div>}
          {eventsQuery.isError && <div className="mt-5 rounded-2xl border border-destructive/20 bg-destructive/[0.05] px-4 py-5 text-center"><TriangleAlert className="mx-auto h-5 w-5 text-destructive" /><p className="mt-2 text-sm font-semibold text-card-foreground">Não foi possível carregar os eventos</p><button type="button" onClick={() => void eventsQuery.refetch()} className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground"><RefreshCw className="h-3.5 w-3.5" />Tentar novamente</button></div>}
          {eventsQuery.isSuccess && !records.length && <div className="py-14 text-center"><ListTree className="mx-auto h-7 w-7 text-primary" /><p className="mt-3 text-sm font-semibold text-card-foreground">Nenhum evento encontrado</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Ajuste os filtros ou inicie uma sessão de monitoramento para gerar registros.</p></div>}
          {eventsQuery.isSuccess && records.length > 0 && <>
            <div className="mt-5 hidden overflow-x-auto md:block"><table className="w-full min-w-[720px] text-left text-xs"><thead className="border-b border-border/80 text-[10px] font-semibold uppercase tracking-[0.11em] text-muted-foreground"><tr><th className="pb-3 pr-4">Momento</th><th className="pb-3 pr-4">Evento</th><th className="pb-3 pr-4">Contexto</th><th className="pb-3 pr-4">Leitura</th><th className="pb-3">Detalhes</th></tr></thead><tbody className="divide-y divide-border/70">{currentRecords.map((event) => <tr key={event.id} className="align-top text-muted-foreground"><td className="whitespace-nowrap py-4 pr-4 font-medium text-card-foreground">{formatDateTime(event.createdAt)}</td><td className="py-4 pr-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${eventTone(event.eventType)}`}>{eventTypeLabels[event.eventType as EventType] ?? event.eventType}</span></td><td className="py-4 pr-4"><p className="font-medium text-card-foreground">{event.petName ?? 'Animal não identificado'}</p><p className="mt-1 text-[11px] text-muted-foreground">{event.cameraName ?? 'Câmera indisponível'}</p></td><td className="py-4 pr-4">{event.identificationStatus ? identificationLabels[event.identificationStatus as IdentificationStatus] ?? event.identificationStatus : '—'}</td><td className="py-4"><details><summary className="cursor-pointer text-xs font-semibold text-primary hover:text-primary-hover">Consultar</summary><EventDetails event={event} /></details></td></tr>)}</tbody></table></div>
            <div className="mt-5 space-y-3 md:hidden">{currentRecords.map((event) => <article key={event.id} className="rounded-2xl border border-border/70 bg-background/45 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-card-foreground">{event.petName ?? 'Animal não identificado'}</p><p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(event.createdAt)} · {event.cameraName ?? 'Câmera indisponível'}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ${eventTone(event.eventType)}`}>{eventTypeLabels[event.eventType as EventType] ?? event.eventType}</span></div><p className="mt-3 text-xs text-muted-foreground">{event.identificationStatus ? identificationLabels[event.identificationStatus as IdentificationStatus] ?? event.identificationStatus : 'Sem status de identificação'}</p><details className="mt-3 border-t border-border/70 pt-3"><summary className="cursor-pointer text-xs font-semibold text-primary">Detalhes</summary><EventDetails event={event} /></details></article>)}</div>
            <div className="mt-5 flex flex-col gap-3 border-t border-border/80 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Mostrando {Math.min((currentPage - 1) * EVENTS_PER_PAGE + 1, records.length)}–{Math.min(currentPage * EVENTS_PER_PAGE, records.length)} de {records.length}</p><div className="flex items-center gap-2"><button type="button" disabled={currentPage <= 1} onClick={() => setPage((current) => current - 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground transition hover:border-primary/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45" aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></button><span className="min-w-20 text-center text-xs font-semibold text-card-foreground">Página {currentPage} de {totalPages}</span><button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((current) => current + 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground transition hover:border-primary/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45" aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></button></div></div>
          </>}
        </section>

        <ReportExportDialog
          open={isExportDialogOpen}
          isExporting={isExporting}
          canExport={{ summary: false, events: eventsQuery.isSuccess, timeline: false }}
          error={exportError}
          onClose={() => {
            if (!isExporting) {
              setExportError(null);
              setIsExportDialogOpen(false);
            }
          }}
          onExport={handleExport}
        />
      </div>
    </div>
  );
}
