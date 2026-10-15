'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Bell,
  Camera,
  Check,
  Clock3,
  Dog,
  Gauge,
  History,
  Radio,
  RefreshCw,
  TriangleAlert,
  Wifi,
} from 'lucide-react';
import { toast } from 'sonner';

import { StreamDetectionOverlay } from '@/components/stream-detection-overlay';
import { type StreamDetection } from '@/lib/identification-display';
import { activateAiStream, AI_ENGINE_URL } from '@/lib/ai-stream';
import { trpc } from '@/utils/trpc';

type EventKind = 'pet_detected' | 'pet_left';
type Filter = 'all' | 'alerts';
type EventItem = {
  id: number;
  kind: EventKind;
  time: Date;
  message: string;
  duration: string;
  petNames?: string[];
};
type EngineEvent = {
  id: number;
  kind: EventKind;
  timestamp: number;
  message: string;
  absent_duration_seconds?: number;
  pet_names?: string[];
};
type EngineStatus = {
  status: string;
  pet_present: boolean;
  sampling_rate?: string;
  last_seen?: string | number | null;
  stream_running?: boolean;
  camera_source?: string;
  fps?: number;
  latency_ms?: number;
  detections?: StreamDetection[];
  frame_width?: number;
  frame_height?: number;
  recent_events?: EngineEvent[];
};
type PersistedEventKind = 'pet_left' | 'identification' | 'activity_changed';
type PersistedEventItem = {
  id: string;
  kind: PersistedEventKind;
  time: Date;
  label: string;
  message: string;
  duration: string;
  shouldNotify: boolean;
};

const ENGINE_URL = AI_ENGINE_URL;

function formatClock(date: Date) {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function relativeTime(date: Date | null) {
  if (!date) return 'Sem atividade recente';

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 10) return 'Agora mesmo';
  if (seconds < 60) return `Há ${seconds} s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Há ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Há ${hours} h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `Há ${days} d`;

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function eventDetails(value: unknown) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function Metric({
  label,
  value,
  detail,
  icon,
  tone = 'text-primary',
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  tone?: string;
}) {
  return (
    <article className="rounded-2xl border border-border/80 bg-card/75 p-4 shadow-[0_1px_2px_oklch(0_0_0_/_0.025)] backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl bg-surface-raised ${tone}`}>{icon}</span>
      </div>
      <p className="mt-5 text-xl font-semibold tracking-[-0.035em] text-card-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

export default function DashboardHome() {
  const [online, setOnline] = useState(false);
  const [present, setPresent] = useState(true);
  const [streamRunning, setStreamRunning] = useState(false);
  const [lastSeen, setLastSeen] = useState<Date | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [engineMetrics, setEngineMetrics] = useState({ fps: 0, latencyMs: 0 });
  const [detections, setDetections] = useState<StreamDetection[]>([]);
  const [frameSize, setFrameSize] = useState({ width: 16, height: 9 });
  const [filter, setFilter] = useState<Filter>('all');

  const defaultCameraQuery = useQuery(trpc.cameras.getDefault.queryOptions());
  const petsQuery = useQuery(trpc.pets.list.queryOptions());
  const preferencesQuery = useQuery(trpc.monitoringPreferences.get.queryOptions());
  const monitoringEventsQuery = useQuery({
    ...trpc.pets.listMonitoringEvents.queryOptions({
      eventTypes: ['pet_left', 'identification', 'activity_changed'],
      limit: 30,
    }),
    refetchInterval: 3_000,
  });

  const synchronizedDefaultCamera = useRef<string | null>(null);
  const hasHydratedAlerts = useRef(false);
  const latestAlertId = useRef<string | null>(null);
  const defaultCamera = defaultCameraQuery.data;
  const petNamesById = useMemo(
    () => new Map((petsQuery.data ?? []).map((pet) => [pet.id, pet.name])),
    [petsQuery.data],
  );

  async function pollStatus() {
    try {
      const response = await fetch(`${ENGINE_URL}/status`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Engine unavailable');

      const data = (await response.json()) as EngineStatus;
      setOnline(true);
      setPresent(data.pet_present);
      setStreamRunning(data.stream_running ?? false);
      setEngineMetrics({ fps: data.fps ?? 0, latencyMs: data.latency_ms ?? 0 });
      setDetections(data.detections ?? []);
      setFrameSize({ width: data.frame_width || 16, height: data.frame_height || 9 });
      setLastSeen(data.last_seen ? new Date(Number(data.last_seen) * 1000) : null);
      setEvents(
        (data.recent_events ?? []).map((event) => ({
          id: event.id,
          kind: event.kind,
          time: new Date(event.timestamp * 1000),
          message: event.message,
          petNames: event.pet_names,
          duration: event.kind === 'pet_left' && event.absent_duration_seconds
            ? `${Math.round(event.absent_duration_seconds)} s`
            : '--',
        })),
      );
    } catch {
      setOnline(false);
      setStreamRunning(false);
    }
  }

  useEffect(() => {
    void pollStatus();
    const interval = window.setInterval(() => void pollStatus(), streamRunning ? 250 : 1500);
    return () => window.clearInterval(interval);
  }, [streamRunning]);

  useEffect(() => {
    if (!defaultCamera || synchronizedDefaultCamera.current === defaultCamera.id) return;

    const camera = defaultCamera;
    let cancelled = false;
    synchronizedDefaultCamera.current = camera.id;

    async function activateDefaultCamera() {
      try {
        await activateAiStream(camera.source);
        if (!cancelled) void pollStatus();
      } catch {
        if (!cancelled) setStreamRunning(false);
      }
    }

    void activateDefaultCamera();
    return () => {
      cancelled = true;
    };
  }, [defaultCamera]);

  const persistedEvents = useMemo<PersistedEventItem[]>(() => {
    return (monitoringEventsQuery.data ?? []).map((event) => {
      const details = eventDetails(event.details);
      const petNames = stringList(details.petNames);
      const petName = petNames[0] ?? (event.petId ? petNamesById.get(event.petId) : undefined);
      const message = typeof details.message === 'string' ? details.message : undefined;
      const absentDuration = typeof details.absentDurationSeconds === 'number'
        ? `${Math.round(details.absentDurationSeconds)} s`
        : '--';

      if (event.eventType === 'pet_left') {
        return {
          id: event.id,
          kind: 'pet_left',
          time: new Date(event.createdAt),
          label: 'Pet saiu do campo',
          message: message ?? (petName ? `${petName} não está mais visível pela câmera.` : 'Um pet não está mais visível pela câmera.'),
          duration: absentDuration,
          shouldNotify: details.shouldNotify === true,
        };
      }

      if (event.eventType === 'identification') {
        return {
          id: event.id,
          kind: 'identification',
          time: new Date(event.createdAt),
          label: 'Identificação confirmada',
          message: petName ? `${petName} foi reconhecido no monitoramento.` : 'Um pet cadastrado foi reconhecido no monitoramento.',
          duration: '--',
          shouldNotify: false,
        };
      }

      return {
        id: event.id,
        kind: 'activity_changed',
        time: new Date(event.createdAt),
        label: 'Atividade atualizada',
        message: petName ? `A atividade de ${petName} foi atualizada.` : 'A atividade de um pet foi atualizada.',
        duration: '--',
        shouldNotify: false,
      };
    });
  }, [monitoringEventsQuery.data, petNamesById]);

  useEffect(() => {
    const latestAlert = persistedEvents.find((event) => event.kind === 'pet_left');
    if (!latestAlert) {
      hasHydratedAlerts.current = true;
      return;
    }

    if (!hasHydratedAlerts.current) {
      hasHydratedAlerts.current = true;
      latestAlertId.current = latestAlert.id;
      return;
    }

    if (latestAlert.id === latestAlertId.current) return;
    latestAlertId.current = latestAlert.id;
    toast.warning('Alerta de ausência', { description: latestAlert.message });

    if (
      latestAlert.shouldNotify
      && preferencesQuery.data?.browserNotificationsEnabled
      && 'Notification' in window
      && Notification.permission === 'granted'
    ) {
      new Notification('PetVision · alerta de ausência', { body: latestAlert.message });
    }
  }, [persistedEvents, preferencesQuery.data?.browserNotificationsEnabled]);

  const visibleEvents = useMemo(
    () => filter === 'alerts'
      ? persistedEvents.filter((event) => event.kind === 'pet_left')
      : persistedEvents,
    [filter, persistedEvents],
  );
  const detectionCount = events.filter((event) => event.kind === 'pet_detected').length;
  const lastEvent = events[0] ?? persistedEvents[0];
  const identifiedCount = detections.filter((detection) => detection.identification?.status === 'identified').length;
  const cameraLabel = defaultCamera ? `${defaultCamera.name} · câmera padrão` : 'Nenhuma câmera padrão definida';
  const hasDashboardDataError = defaultCameraQuery.isError
    || petsQuery.isError
    || preferencesQuery.isError
    || monitoringEventsQuery.isError;
  const isRefreshingDashboardData = defaultCameraQuery.isRefetching
    || petsQuery.isRefetching
    || preferencesQuery.isRefetching
    || monitoringEventsQuery.isRefetching;

  function retryDashboardData() {
    void Promise.all([
      defaultCameraQuery.refetch(),
      petsQuery.refetch(),
      preferencesQuery.refetch(),
      monitoringEventsQuery.refetch(),
    ]);
  }

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
        <header className="mb-8 flex flex-col gap-5 border-b border-border/80 pb-7 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Central de monitoramento</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-foreground sm:text-4xl">Visão geral</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Acompanhe a presença, o reconhecimento e os alertas da sua casa em tempo real.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[10px] font-semibold uppercase tracking-[0.13em] ${online ? 'border-success/25 bg-success/10 text-success' : 'border-border bg-surface-raised text-muted-foreground'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${online ? 'animate-pulse bg-success' : 'bg-muted-foreground'}`} />
              {online ? 'Motor conectado' : 'Motor offline'}
            </span>
            <Link href="/dashboard/cameras" className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-[0_8px_18px_color-mix(in_oklch,var(--primary)_18%,transparent)] transition hover:bg-primary-hover sm:w-auto">
              <Camera className="h-3.5 w-3.5" />
              Gerenciar câmeras
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        {hasDashboardDataError && (
          <section role="alert" className="mb-6 flex flex-col gap-4 rounded-2xl border border-warning/25 bg-warning/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning"><TriangleAlert className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-card-foreground">Algumas informações podem estar desatualizadas</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Não foi possível consultar todos os dados do monitoramento. O vídeo local continua sendo atualizado separadamente.</p></div></div>
            <button type="button" onClick={retryDashboardData} disabled={isRefreshingDashboardData} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-warning/25 bg-card px-3 text-xs font-semibold text-card-foreground transition hover:border-warning/50 hover:bg-warning/10 disabled:cursor-not-allowed disabled:opacity-55"><RefreshCw className={`h-3.5 w-3.5 ${isRefreshingDashboardData ? 'animate-spin' : ''}`} />{isRefreshingDashboardData ? 'Atualizando...' : 'Tentar novamente'}</button>
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.72fr)]">
          <article className="overflow-hidden rounded-[28px] border border-[#253336] bg-[#091113] shadow-[0_22px_50px_oklch(0_0_0_/_0.18)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-[#7ee8db]">
                  <Radio className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-white">Transmissão ao vivo</h2>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{cameraLabel}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] ${streamRunning ? 'border-[#2dd4bf]/30 bg-[#2dd4bf]/10 text-[#67e8d8]' : 'border-white/10 bg-white/[0.04] text-zinc-500'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${streamRunning ? 'animate-pulse bg-[#2dd4bf]' : 'bg-zinc-600'}`} />
                {streamRunning ? 'Ao vivo' : 'Em espera'}
              </span>
            </div>

            <div className="relative flex aspect-video min-h-[280px] items-center justify-center overflow-hidden bg-[#111b1d]">
              {streamRunning ? (
                <>
                  <img src={`${ENGINE_URL}/stream/video`} alt="Feed ao vivo com detecções do motor de IA" className="absolute inset-0 h-full w-full object-contain" />
                  <StreamDetectionOverlay detections={detections} frameWidth={frameSize.width} frameHeight={frameSize.height} />
                  <div aria-live="polite" className="pointer-events-none absolute left-4 top-4 rounded-xl border border-white/10 bg-black/65 px-3 py-2 text-xs font-medium text-zinc-100 shadow-lg shadow-black/20 backdrop-blur-md">
                    {detections.length === 0 ? 'Aguardando animal no enquadramento' : `${identifiedCount} identificado${identifiedCount === 1 ? '' : 's'} · ${detections.length} detectado${detections.length === 1 ? '' : 's'}`}
                  </div>
                </>
              ) : (
                <div className="max-w-xs px-6 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-500">
                    <Wifi className="h-6 w-6" />
                  </span>
                  <p className="mt-4 text-sm font-medium text-zinc-200">{defaultCamera ? 'Preparando a transmissão' : 'Nenhuma câmera selecionada'}</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">{defaultCamera ? 'O motor iniciará a fonte padrão assim que estiver disponível.' : 'Defina uma câmera padrão para iniciar o monitoramento automaticamente.'}</p>
                  {!defaultCamera && <Link href="/dashboard/cameras" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#67e8d8] hover:text-white">Configurar câmera <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
                </div>
              )}

              <div className="absolute bottom-3 left-3 right-3 grid grid-cols-2 overflow-hidden rounded-xl border border-white/10 bg-black/65 text-zinc-300 shadow-lg shadow-black/20 backdrop-blur-md sm:bottom-4 sm:left-auto sm:right-4">
                <div className="border-r border-white/10 px-2.5 py-2 sm:px-3 sm:py-2.5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-zinc-500">Vídeo</p>
                  <p className="mt-1 font-mono text-xs font-semibold text-white">{engineMetrics.fps.toFixed(1)} FPS</p>
                </div>
                <div className="px-2.5 py-2 sm:px-3 sm:py-2.5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-zinc-500">Ciclo</p>
                  <p className="mt-1 font-mono text-xs font-semibold text-white">{engineMetrics.latencyMs.toFixed(0)} ms</p>
                </div>
              </div>
            </div>
          </article>

          <aside className="rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sessão atual</p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.035em] text-card-foreground">Estado do monitoramento</h2>
              </div>
              <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${present ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                <Dog className="h-5 w-5" />
              </span>
            </div>

            <div className={`mt-6 rounded-2xl border p-4 ${present ? 'border-success/20 bg-success/[0.06]' : 'border-destructive/20 bg-destructive/[0.06]'}`}>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${present ? 'animate-pulse bg-success' : 'bg-destructive'}`} />
                <p className={`text-sm font-semibold ${present ? 'text-success' : 'text-destructive'}`}>{present ? 'Pet visível na câmera' : 'Nenhuma presença recente'}</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{present ? 'O motor detectou um animal no enquadramento ativo.' : 'O sistema continua monitorando a fonte configurada.'}</p>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-border/80 pt-5">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Última leitura</dt>
                <dd className="mt-1.5 text-sm font-semibold text-card-foreground">{relativeTime(lastSeen)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Reconhecidos</dt>
                <dd className="mt-1.5 text-sm font-semibold text-card-foreground">{identifiedCount} agora</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Câmera</dt>
                <dd className="mt-1.5 truncate text-sm font-semibold text-card-foreground">{defaultCamera?.name ?? 'Não definida'}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Motor</dt>
                <dd className={`mt-1.5 text-sm font-semibold ${online ? 'text-success' : 'text-muted-foreground'}`}>{online ? 'Conectado' : 'Offline'}</dd>
              </div>
            </dl>
          </aside>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Presença" value={present ? 'Presente' : 'Ausente'} detail={present ? 'No campo de visão' : 'Sem leitura recente'} icon={<span className={`h-2.5 w-2.5 rounded-full ${present ? 'bg-success' : 'bg-destructive'}`} />} tone={present ? 'text-success' : 'text-destructive'} />
          <Metric label="Detecções" value={String(detectionCount)} detail="Nesta sessão" icon={<Activity className="h-4 w-4" />} tone="text-info" />
          <Metric label="Processamento" value={`${engineMetrics.fps.toFixed(1)} FPS`} detail="Pré-visualização ativa" icon={<Gauge className="h-4 w-4" />} />
          <Metric label="Último evento" value={lastEvent ? formatClock(lastEvent.time) : '—'} detail={lastEvent ? lastEvent.message : 'Sem eventos na sessão'} icon={<Clock3 className="h-4 w-4" />} tone="text-warning" />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <article className="rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6">
            <div className="flex flex-col gap-4 border-b border-border/80 pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Em tempo real</p>
                <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Eventos recentes</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Atualizações persistidas durante o monitoramento.</p>
              </div>
              <div role="group" aria-label="Filtrar eventos" className="flex rounded-xl border border-border bg-surface-raised/65 p-1 text-[11px] font-medium">
                <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')} className={`rounded-lg px-3 py-1.5 transition ${filter === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Tudo</button>
                <button type="button" aria-pressed={filter === 'alerts'} onClick={() => setFilter('alerts')} className={`rounded-lg px-3 py-1.5 transition ${filter === 'alerts' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Alertas</button>
              </div>
            </div>

            <div className="mt-2 divide-y divide-border/75">
              {visibleEvents.slice(0, 5).map((event) => {
                const isAlert = event.kind === 'pet_left';
                const isIdentification = event.kind === 'identification';
                return (
                  <div key={event.id} className="flex gap-3 py-4 first:pt-3 last:pb-1">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isAlert ? 'bg-destructive/10 text-destructive' : isIdentification ? 'bg-success/10 text-success' : 'bg-info/10 text-info'}`}>
                      {isAlert ? <Bell className="h-4 w-4" /> : isIdentification ? <Check className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-card-foreground">{event.label}</p>
                        <time className="shrink-0 font-mono text-[10px] text-muted-foreground">{formatClock(event.time)}</time>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{event.message}</p>
                    </div>
                  </div>
                );
              })}
              {visibleEvents.length === 0 && (
                <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-raised text-muted-foreground"><History className="h-5 w-5" /></span>
                  <p className="mt-3 text-sm font-medium text-card-foreground">Nenhum evento por enquanto</p>
                  <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">Os registros de identificação, atividade e ausência aparecerão aqui.</p>
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-border/80 pb-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Histórico</p>
                <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Últimos registros</h2>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-raised text-muted-foreground"><History className="h-4 w-4" /></span>
            </div>

            <div className="mt-1 divide-y divide-border/75">
              {persistedEvents.slice(0, 5).map((event) => {
                const isAlert = event.kind === 'pet_left';
                return (
                  <div key={`history-${event.id}`} className="flex items-center gap-3 py-3.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${isAlert ? (event.shouldNotify ? 'bg-destructive' : 'bg-warning') : 'bg-success'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-card-foreground">{event.label}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{event.message}</p>
                    </div>
                    <time className="shrink-0 font-mono text-[10px] text-muted-foreground">{formatClock(event.time)}</time>
                  </div>
                );
              })}
              {persistedEvents.length === 0 && (
                <div className="flex min-h-48 flex-col items-center justify-center text-center">
                  <p className="text-sm font-medium text-card-foreground">Histórico vazio</p>
                  <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">Os eventos persistidos permanecerão disponíveis após atualizar a página.</p>
                </div>
              )}
            </div>
          </article>
        </section>

        <footer className="flex items-center gap-2 py-7 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Monitoramento local e privado
        </footer>
      </div>
    </div>
  );
}
