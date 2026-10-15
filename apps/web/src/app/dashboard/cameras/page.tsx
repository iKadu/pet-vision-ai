'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Camera,
  Check,
  CircleDot,
  LoaderCircle,
  Monitor,
  Pencil,
  Play,
  Radio,
  RefreshCw,
  Square,
  Trash2,
  Video,
  X,
} from 'lucide-react';

import { StreamDetectionOverlay } from '@/components/stream-detection-overlay';
import { type StreamDetection } from '@/lib/identification-display';
import { activateAiStream, AI_ENGINE_URL } from '@/lib/ai-stream';
import { trpc } from '@/utils/trpc';

const ENGINE_URL = AI_ENGINE_URL;
const ENGINE_REQUEST_TIMEOUT_MS = 5_000;
type CameraType = 'webcam' | 'screen' | 'rtsp';

type StreamStatus = {
  stream_running: boolean;
  detections: StreamDetection[];
  frame_width: number;
  frame_height: number;
  target_fps: number;
  preview_fps: number;
  capture_fps: number;
  fps: number;
  latency_ms: number;
  cycle_latency_ms: number;
};

function sourceLabel(source: CameraType) {
  if (source === 'webcam') return 'Webcam local';
  if (source === 'screen') return 'Tela do computador';
  return 'Câmera IP';
}

function sourceDescription(source: CameraType) {
  if (source === 'webcam') return 'Dispositivo conectado ao computador';
  if (source === 'screen') return 'Captura do monitor selecionado';
  return 'Transmissão segura por RTSP';
}

async function fetchEngine(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ENGINE_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${ENGINE_URL}${path}`, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default function CamerasPage() {
  const [source, setSource] = useState<CameraType>('webcam');
  const [rtspUrl, setRtspUrl] = useState('');
  const [cameraName, setCameraName] = useState('');
  const [running, setRunning] = useState(false);
  const [isTogglingStream, setIsTogglingStream] = useState(false);
  const [message, setMessage] = useState('');
  const [editingCamera, setEditingCamera] = useState<{
    id: string;
    name: string;
    type: CameraType;
    source: string;
  } | null>(null);

  const camerasQuery = useQuery(trpc.cameras.list.queryOptions());
  const streamStatusQuery = useQuery({
    queryKey: ['ai-stream-status'],
    queryFn: async (): Promise<StreamStatus> => {
      const response = await fetchEngine('/status');
      if (!response.ok) throw new Error('Não foi possível obter o estado do monitoramento');
      return response.json() as Promise<StreamStatus>;
    },
    enabled: running,
    refetchInterval: running ? 250 : false,
    retry: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function synchronizeStreamState() {
      try {
        const response = await fetchEngine('/status', { cache: 'no-store' });
        if (!response.ok) throw new Error('Estado do motor indisponível');
        const status = (await response.json()) as StreamStatus;
        if (!cancelled) setRunning(Boolean(status.stream_running));
      } catch {
        if (!cancelled) setRunning(false);
      }
    }

    void synchronizeStreamState();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (streamStatusQuery.data) {
      setRunning(Boolean(streamStatusQuery.data.stream_running));
    }
  }, [streamStatusQuery.data]);

  const streamDetections = streamStatusQuery.data?.detections ?? [];
  const frameWidth = streamStatusQuery.data?.frame_width || 16;
  const frameHeight = streamStatusQuery.data?.frame_height || 9;
  const targetFps = streamStatusQuery.data?.target_fps ?? 2;
  const captureFps = streamStatusQuery.data?.capture_fps ?? 0;
  const measuredFps = streamStatusQuery.data?.fps ?? 0;
  const cycleLatency = streamStatusQuery.data?.cycle_latency_ms ?? 0;
  const identifiedCount = streamDetections.filter(
    (detection) => detection.identification?.status === 'identified',
  ).length;
  const pendingIdentificationCount = streamDetections.filter(
    (detection) => detection.identification?.status === 'confirming'
      || detection.identification?.status === 'possible',
  ).length;

  const createCamera = useMutation(
    trpc.cameras.create.mutationOptions({
      onSuccess: async (camera) => {
        void camerasQuery.refetch();
        setCameraName('');
        if (!camera.isDefault) {
          setMessage('Câmera salva com sucesso.');
          return;
        }

        try {
          await activateAiStream(camera.source);
          setRunning(true);
          void streamStatusQuery.refetch();
          setMessage(`“${camera.name}” foi salva como câmera padrão e está ativa no feed ao vivo.`);
        } catch {
          setMessage(`“${camera.name}” foi salva como padrão, mas não pôde ser iniciada agora.`);
        }
      },
    }),
  );
  const updateCamera = useMutation(
    trpc.cameras.update.mutationOptions({
      onSuccess: () => {
        void camerasQuery.refetch();
        setEditingCamera(null);
        setMessage('Câmera atualizada com sucesso.');
      },
    }),
  );
  const setDefaultCamera = useMutation(trpc.cameras.setDefault.mutationOptions());
  const deleteCamera = useMutation(
    trpc.cameras.delete.mutationOptions({
      onSuccess: () => {
        void camerasQuery.refetch();
        setMessage('Câmera excluída com sucesso.');
      },
    }),
  );

  const defaultCamera = camerasQuery.data?.find((camera) => camera.isDefault);

  useEffect(() => {
    if (!defaultCamera) return;
    setSource(defaultCamera.type as CameraType);
    if (defaultCamera.type === 'rtsp') setRtspUrl(defaultCamera.source);
  }, [defaultCamera]);

  function getSourceValue() {
    return source === 'webcam'
      ? '0'
      : source === 'screen'
        ? 'screen'
        : rtspUrl.trim();
  }

  function selectSource(nextSource: CameraType) {
    setSource(nextSource);
    setMessage('Fonte selecionada para configuração. Salve-a e defina-a como padrão para aplicá-la ao feed.');
  }

  async function toggleStream() {
    if (isTogglingStream) return;

    const action = running ? 'stop' : 'start';
    setIsTogglingStream(true);
    try {
      if (action === 'start') {
        await activateAiStream(defaultCamera?.source ?? getSourceValue());
      } else {
        const response = await fetchEngine('/stream/stop', { method: 'POST' });
        if (!response.ok) throw new Error('Não foi possível alterar o monitoramento');
      }
      setRunning(action === 'start');
      setMessage(action === 'start' ? 'Monitoramento iniciado.' : 'Monitoramento pausado.');
    } catch {
      setMessage('O motor local não respondeu. Verifique se o AI Engine está ativo.');
    } finally {
      setIsTogglingStream(false);
    }
  }

  async function setCameraAsDefault(camera: {
    id: string;
    type: string;
    source: string;
    isDefault: boolean;
  }) {
    if (camera.isDefault || setDefaultCamera.isPending) return;

    let preferenceSaved = false;
    try {
      const updatedDefaultCamera = await setDefaultCamera.mutateAsync({ id: camera.id });
      preferenceSaved = true;
      setSource(updatedDefaultCamera.type as CameraType);
      if (updatedDefaultCamera.type === 'rtsp') setRtspUrl(updatedDefaultCamera.source);
      void camerasQuery.refetch();
      await activateAiStream(updatedDefaultCamera.source);
      setRunning(true);
      void streamStatusQuery.refetch();
      setMessage(`“${updatedDefaultCamera.name}” agora é a câmera padrão e está ativa no feed ao vivo.`);
    } catch {
      setMessage(
        preferenceSaved
          ? 'A preferência foi salva, mas não foi possível iniciar a câmera padrão.'
          : 'Não foi possível definir a câmera padrão.',
      );
    }
  }

  function saveCamera(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sourceValue = getSourceValue();

    if (!cameraName.trim()) {
      setMessage('Informe um nome para a câmera.');
      return;
    }

    if (source === 'rtsp' && !sourceValue.startsWith('rtsp://')) {
      setMessage('Informe uma URL RTSP válida.');
      return;
    }

    createCamera.mutate({ name: cameraName.trim(), type: source, source: sourceValue });
  }

  function saveCameraEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCamera?.name.trim() || updateCamera.isPending) return;

    updateCamera.mutate({
      id: editingCamera.id,
      data: {
        name: editingCamera.name.trim(),
        type: editingCamera.type,
        source: editingCamera.source.trim(),
      },
    });
  }

  function removeCamera(id: string) {
    if (deleteCamera.isPending || !window.confirm('Excluir esta câmera?')) return;
    deleteCamera.mutate({ id });
  }

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
        <header className="mb-8 flex flex-col gap-5 border-b border-border/80 pb-7 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Fontes de vídeo</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-foreground sm:text-4xl">Câmeras</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Escolha a fonte que acompanha seu pet e defina qual transmissão será usada pelo monitoramento.</p>
          </div>
          <div className={`inline-flex h-8 w-fit items-center gap-2 rounded-full border px-3 text-[10px] font-semibold uppercase tracking-[0.13em] ${running ? 'border-success/25 bg-success/10 text-success' : 'border-border bg-surface-raised text-muted-foreground'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${running ? 'animate-pulse bg-success' : 'bg-muted-foreground'}`} />
            {running ? 'Monitoramento ativo' : 'Monitoramento pausado'}
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden rounded-[28px] border border-[#253336] bg-[#091113] shadow-[0_22px_50px_oklch(0_0_0_/_0.18)]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-[#7ee8db]">
                  <Video className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-white">Pré-visualização</h2>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{camerasQuery.isPending ? 'Carregando fontes salvas...' : defaultCamera ? `${defaultCamera.name} · câmera padrão` : 'Nenhuma câmera padrão definida'}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] ${running ? 'border-[#2dd4bf]/30 bg-[#2dd4bf]/10 text-[#67e8d8]' : 'border-white/10 bg-white/[0.04] text-zinc-500'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${running ? 'animate-pulse bg-[#2dd4bf]' : 'bg-zinc-600'}`} />
                {running ? 'Ao vivo' : 'Em espera'}
              </span>
            </div>

            <div className="relative flex aspect-video min-h-[310px] items-center justify-center overflow-hidden bg-[#111b1d]">
              {running ? (
                <>
                  <img
                    src={`${ENGINE_URL}/stream/video`}
                    alt={`Pré-visualização da câmera padrão${defaultCamera ? `: ${defaultCamera.name}` : ''}`}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                  <StreamDetectionOverlay detections={streamDetections} frameWidth={frameWidth} frameHeight={frameHeight} />
                  <div aria-live="polite" className="pointer-events-none absolute left-4 top-4 rounded-xl border border-white/10 bg-black/65 px-3 py-2 text-xs font-medium text-zinc-100 shadow-lg shadow-black/20 backdrop-blur-md">
                    {streamStatusQuery.isError
                      ? 'Aguardando dados de identificação'
                      : streamDetections.length === 0
                        ? 'Aguardando animal no enquadramento'
                        : `${identifiedCount} confirmado${identifiedCount === 1 ? '' : 's'}${pendingIdentificationCount ? ` · ${pendingIdentificationCount} em análise` : ''} · ${streamDetections.length} detectado${streamDetections.length === 1 ? '' : 's'}`}
                  </div>
                </>
              ) : camerasQuery.isPending ? (
                <div className="max-w-xs px-6 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#67e8d8]"><LoaderCircle className="h-6 w-6 animate-spin" /></span>
                  <p className="mt-4 text-sm font-medium text-zinc-200">Carregando suas câmeras</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">Estamos verificando qual fonte deve ser usada no monitoramento.</p>
                </div>
              ) : (
                <div className="max-w-xs px-6 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-500"><Video className="h-6 w-6" /></span>
                  <p className="mt-4 text-sm font-medium text-zinc-200">{defaultCamera ? 'Transmissão em espera' : 'Escolha uma fonte para começar'}</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">{defaultCamera ? 'Inicie o monitoramento para visualizar e analisar a câmera padrão.' : 'Salve uma câmera e defina-a como padrão para ativar o feed ao vivo.'}</p>
                </div>
              )}

              <dl aria-label="Desempenho do monitoramento" className="pointer-events-none absolute bottom-3 left-3 right-3 grid grid-cols-2 overflow-hidden rounded-xl border border-white/10 bg-black/65 text-zinc-300 shadow-lg shadow-black/20 backdrop-blur-md sm:bottom-4 sm:left-auto sm:right-4 sm:grid-cols-4">
                <div className="border-b border-r border-white/10 px-2.5 py-2 sm:border-b-0 sm:px-3 sm:py-2.5">
                  <dt className="text-[9px] font-semibold uppercase tracking-[0.13em] text-zinc-500">Vídeo</dt>
                  <dd className="mt-1 font-mono text-xs font-semibold text-white">{captureFps > 0 ? `${captureFps.toFixed(1)} FPS` : '—'}</dd>
                </div>
                <div className="border-b border-white/10 px-2.5 py-2 sm:border-b-0 sm:border-r sm:px-3 sm:py-2.5">
                  <dt className="text-[9px] font-semibold uppercase tracking-[0.13em] text-zinc-500">IA alvo</dt>
                  <dd className="mt-1 font-mono text-xs font-semibold text-white">{targetFps.toFixed(1)} FPS</dd>
                </div>
                <div className="border-r border-white/10 px-2.5 py-2 sm:px-3 sm:py-2.5">
                  <dt className="text-[9px] font-semibold uppercase tracking-[0.13em] text-zinc-500">Real</dt>
                  <dd className="mt-1 font-mono text-xs font-semibold text-white">{measuredFps > 0 ? `${measuredFps.toFixed(1)} FPS` : '—'}</dd>
                </div>
                <div className="px-2.5 py-2 sm:px-3 sm:py-2.5">
                  <dt className="text-[9px] font-semibold uppercase tracking-[0.13em] text-zinc-500">Ciclo</dt>
                  <dd className="mt-1 font-mono text-xs font-semibold text-white">{cycleLatency > 0 ? `${Math.round(cycleLatency)} ms` : '—'}</dd>
                </div>
              </dl>
            </div>

            <div className="flex flex-col gap-4 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-xs leading-5 text-zinc-500">{message || 'O vídeo e a análise são processados localmente.'}</p>
              <button
                type="button"
                onClick={() => void toggleStream()}
                disabled={isTogglingStream}
                className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-zinc-950 shadow-sm transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {running ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                {isTogglingStream ? (running ? 'Parando...' : 'Conectando...') : running ? 'Parar monitoramento' : 'Iniciar monitoramento'}
              </button>
            </div>
          </section>

          <aside className="self-start rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><Camera className="h-5 w-5" /></span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Nova fonte</p>
                <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Adicionar câmera</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">A câmera marcada como padrão será usada pelo motor.</p>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <button type="button" aria-pressed={source === 'webcam'} onClick={() => selectSource('webcam')} className={`group flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition ${source === 'webcam' ? 'border-primary/50 bg-accent text-accent-foreground shadow-sm' : 'border-border bg-card text-muted-foreground hover:border-primary/35 hover:bg-surface-raised hover:text-foreground'}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${source === 'webcam' ? 'bg-primary text-primary-foreground' : 'bg-surface-raised text-muted-foreground group-hover:text-foreground'}`}><Camera className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Webcam local</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Dispositivo 0</span>
                </span>
                {source === 'webcam' && <Check className="h-4 w-4 text-primary" />}
              </button>

              <button type="button" aria-pressed={source === 'screen'} onClick={() => selectSource('screen')} className={`group flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition ${source === 'screen' ? 'border-primary/50 bg-accent text-accent-foreground shadow-sm' : 'border-border bg-card text-muted-foreground hover:border-primary/35 hover:bg-surface-raised hover:text-foreground'}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${source === 'screen' ? 'bg-primary text-primary-foreground' : 'bg-surface-raised text-muted-foreground group-hover:text-foreground'}`}><Monitor className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Tela do computador</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Captura do monitor selecionado</span>
                </span>
                {source === 'screen' && <Check className="h-4 w-4 text-primary" />}
              </button>

              <button type="button" aria-pressed={source === 'rtsp'} onClick={() => selectSource('rtsp')} className={`group flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition ${source === 'rtsp' ? 'border-primary/50 bg-accent text-accent-foreground shadow-sm' : 'border-border bg-card text-muted-foreground hover:border-primary/35 hover:bg-surface-raised hover:text-foreground'}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${source === 'rtsp' ? 'bg-primary text-primary-foreground' : 'bg-surface-raised text-muted-foreground group-hover:text-foreground'}`}><Radio className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Câmera IP</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Transmissão RTSP</span>
                </span>
                {source === 'rtsp' && <Check className="h-4 w-4 text-primary" />}
              </button>
            </div>

            {source === 'rtsp' && (
              <div className="mt-4 rounded-2xl border border-border bg-surface-raised/55 p-4">
                <label htmlFor="rtsp-url" className="text-xs font-semibold text-foreground">URL RTSP</label>
                <input id="rtsp-url" value={rtspUrl} onChange={(event) => setRtspUrl(event.target.value)} placeholder="rtsp://usuario:senha@ip:554/stream" className="mt-2 h-10 w-full rounded-xl border border-border bg-card px-3 text-xs text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15" />
                <p className="mt-2 text-[11px] leading-4 text-muted-foreground">A URL é mantida protegida e não aparece no status do motor.</p>
              </div>
            )}

            <form onSubmit={saveCamera} className="mt-6 border-t border-border/80 pt-5">
              <label htmlFor="camera-name" className="text-xs font-semibold text-foreground">Nome da câmera</label>
              <input id="camera-name" value={cameraName} onChange={(event) => setCameraName(event.target.value)} placeholder="Ex.: Sala" className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15" />
              <button type="submit" disabled={createCamera.isPending} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-[0_8px_18px_color-mix(in_oklch,var(--primary)_18%,transparent)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
                <Check className="h-4 w-4" />
                {createCamera.isPending ? 'Salvando...' : 'Salvar câmera'}
              </button>
            </form>
          </aside>
        </div>

        {camerasQuery.isPending && (
          <section className="mt-6 rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6" aria-label="Carregando câmeras salvas">
            <div className="h-3 w-28 animate-pulse rounded-full bg-surface-raised" />
            <div className="mt-3 h-5 w-48 animate-pulse rounded-lg bg-surface-raised" />
            <div className="mt-6 grid gap-3 lg:grid-cols-2">{[0, 1].map((index) => <div key={index} className="h-36 animate-pulse rounded-2xl border border-border/70 bg-surface-raised/50" />)}</div>
          </section>
        )}

        {camerasQuery.isError && (
          <section className="mt-6 rounded-[28px] border border-destructive/25 bg-destructive/[0.06] px-5 py-10 text-center shadow-[0_12px_35px_oklch(0_0_0_/_0.03)] sm:px-8">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><X className="h-5 w-5" /></span>
            <h2 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Não foi possível carregar as câmeras</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">A fonte de vídeo continua disponível para configuração, mas a lista de câmeras salvas não pôde ser consultada agora.</p>
            <button type="button" onClick={() => void camerasQuery.refetch()} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover"><RefreshCw className="h-4 w-4" />Tentar novamente</button>
          </section>
        )}

        {camerasQuery.isSuccess && camerasQuery.data.length === 0 && (
          <section className="mt-6 rounded-[28px] border border-dashed border-border bg-card/65 px-5 py-11 text-center sm:px-8">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><Camera className="h-5 w-5" /></span>
            <h2 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Sua biblioteca de câmeras está vazia</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Escolha uma fonte no painel acima, dê um nome a ela e salve para torná-la disponível no monitoramento.</p>
          </section>
        )}

        {camerasQuery.isSuccess && camerasQuery.data.length > 0 && (
          <section className="mt-6 rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6">
            <div className="flex flex-col gap-3 border-b border-border/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Biblioteca de fontes</p>
                <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Câmeras salvas</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Defina uma câmera padrão para usá-la automaticamente no monitoramento.</p>
              </div>
              <span className="inline-flex h-7 items-center rounded-full bg-surface-raised px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{camerasQuery.data.length} {camerasQuery.data.length === 1 ? 'câmera' : 'câmeras'}</span>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {camerasQuery.data.map((camera) => {
                const type = camera.type as CameraType;
                const SourceIcon = type === 'webcam' ? Camera : type === 'screen' ? Monitor : Radio;

                if (editingCamera?.id === camera.id) {
                  return (
                    <form key={camera.id} onSubmit={saveCameraEdit} className="rounded-2xl border border-primary/30 bg-accent/50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-card-foreground">Editar fonte</p>
                        <button type="button" aria-label="Cancelar edição" onClick={() => setEditingCamera(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground"><X className="h-4 w-4" /></button>
                      </div>
                      <input aria-label="Nome da câmera" value={editingCamera.name} onChange={(event) => setEditingCamera({ ...editingCamera, name: event.target.value })} className="mt-4 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                      <div className="mt-2 grid grid-cols-[112px_minmax(0,1fr)] gap-2">
                        <select aria-label="Tipo da câmera" value={editingCamera.type} onChange={(event) => setEditingCamera({ ...editingCamera, type: event.target.value as CameraType })} className="h-10 rounded-xl border border-border bg-card px-2 text-xs text-foreground outline-none focus:border-primary">
                          <option value="webcam">Webcam</option>
                          <option value="screen">Tela</option>
                          <option value="rtsp">RTSP</option>
                        </select>
                        <input aria-label="Origem da câmera" value={editingCamera.source} onChange={(event) => setEditingCamera({ ...editingCamera, source: event.target.value })} className="min-w-0 rounded-xl border border-border bg-card px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        <button type="button" onClick={() => setEditingCamera(null)} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground"><X className="h-3.5 w-3.5" />Cancelar</button>
                        <button type="submit" disabled={updateCamera.isPending} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:opacity-50"><Check className="h-3.5 w-3.5" />{updateCamera.isPending ? 'Salvando...' : 'Salvar'}</button>
                      </div>
                    </form>
                  );
                }

                return (
                  <article key={camera.id} className={`group rounded-2xl border p-4 transition ${camera.isDefault ? 'border-primary/30 bg-accent/35' : 'border-border bg-card hover:border-primary/30 hover:shadow-sm'}`}>
                    <div className="flex items-start gap-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${camera.isDefault ? 'bg-primary text-primary-foreground' : 'bg-surface-raised text-muted-foreground'}`}><SourceIcon className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-card-foreground">{camera.name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{sourceLabel(type)} · {camera.source === '0' ? 'Dispositivo 0' : type === 'rtsp' ? 'URL RTSP configurada' : 'Captura de tela'}</p>
                          </div>
                          {camera.isDefault && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.11em] text-success"><CircleDot className="h-3 w-3" />Padrão</span>}
                        </div>
                        <p className="mt-3 text-[11px] leading-4 text-muted-foreground">{sourceDescription(type)}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
                      <button type="button" disabled={camera.isDefault || deleteCamera.isPending || setDefaultCamera.isPending} onClick={() => void setCameraAsDefault(camera)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition disabled:cursor-default ${camera.isDefault ? 'bg-success/10 text-success' : 'bg-surface-raised text-foreground hover:bg-accent disabled:opacity-50'}`}>
                        {camera.isDefault ? <Check className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                        {camera.isDefault ? 'Padrão ativo' : 'Definir padrão'}
                      </button>
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label={`Editar ${camera.name}`} onClick={() => setEditingCamera({ id: camera.id, name: camera.name, type, source: camera.source })} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-surface-raised hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                        <button type="button" aria-label={`Excluir ${camera.name}`} onClick={() => removeCamera(camera.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
