'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Bell, Check, Clock3, Dog, Wifi } from 'lucide-react';

type EventKind = 'pet_detected' | 'pet_left';
type Filter = 'all' | 'alerts';
type EventItem = { id: number; kind: EventKind; time: Date; message: string; duration: string; petNames?: string[] };
type StreamDetection = {
  track_id?: number;
  bbox: { x: number; y: number; width: number; height: number };
  identification?: {
    status: 'identified' | 'unknown';
    pet_name?: string;
    similarity?: number;
  };
};
type EngineEvent = { id: number; kind: EventKind; timestamp: number; message: string; absent_duration_seconds?: number; pet_names?: string[] };
type EngineStatus = { status: string; pet_present: boolean; sampling_rate?: string; last_seen?: string | number | null; stream_running?: boolean; fps?: number; latency_ms?: number; detections?: StreamDetection[]; frame_width?: number; frame_height?: number; recent_events?: EngineEvent[] };

const ENGINE_URL = 'http://localhost:8000';
function formatClock(date: Date) {
  return [date.getHours(), date.getMinutes(), date.getSeconds()].map((part) => String(part).padStart(2, '0')).join(':');
}

function relativeTime(date: Date | null) {
  if (!date) return 'No recent activity';
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function EventIcon({ kind }: { kind: EventKind }) {
  return kind === 'pet_detected' ? <Dog className="h-4 w-4" /> : <Bell className="h-4 w-4" />;
}

function Stat({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: React.ReactNode; tone: string }) {
  return (
    <article className="border-b border-zinc-200 bg-white p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="flex items-start justify-between gap-4"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{label}</p><span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-50 ${tone}`}>{icon}</span></div>
      <p className="mt-5 whitespace-nowrap text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
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
    const interval = window.setInterval(() => void pollStatus(), 3000);
    return () => window.clearInterval(interval);
  }, []);

  const visibleEvents = useMemo(() => filter === 'alerts' ? events.filter((event) => event.kind === 'pet_left') : events, [events, filter]);
  const detectionCount = events.filter((event) => event.kind === 'pet_detected').length;
  const lastEvent = events[0];
  const identifiedCount = detections.filter((detection) => detection.identification?.status === 'identified').length;

  function detectionLabel(detection: StreamDetection) {
    if (detection.identification?.status === 'identified') {
      const confidence = detection.identification.similarity
        ? ` · ${Math.round(detection.identification.similarity * 100)}%`
        : '';
      return `${detection.identification.pet_name ?? 'Pet'}${confidence}`;
    }

    return detection.identification?.status === 'unknown' ? 'Não identificado' : 'Analisando';
  }

  return (
    <div className="min-h-screen text-zinc-900">
      <div className="min-w-0">
        <div className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:px-10">
          <header className="mb-8 border-b border-zinc-200 pb-7"><div className="flex items-end justify-between gap-5"><div><h1 className="text-3xl font-semibold tracking-[-0.03em] text-zinc-950">Início</h1><p className="mt-2 text-sm text-zinc-500">O estado da sua casa, em um só lugar.</p></div><span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${online ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-100 text-zinc-500'}`}><span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-zinc-400'}`} />{online ? 'Motor conectado' : 'Motor offline'}</span></div></header>
          <section className="mb-7 grid overflow-hidden rounded-xl border border-zinc-200 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Presença" value={present ? 'Presente' : 'Ausente'} detail={present ? 'Pet visível recentemente' : 'Nenhuma presença recente'} tone={present ? 'text-emerald-600' : 'text-rose-500'} icon={<span className={`h-2.5 w-2.5 rounded-full ${present ? 'bg-emerald-500' : 'bg-rose-500'}`} />} />
            <Stat label="Última detecção" value={relativeTime(lastSeen)} detail={lastEvent ? formatClock(lastEvent.time) : 'Sem registro'} tone="text-sky-600" icon={<Clock3 className="h-4 w-4" />} />
            <Stat label="Detecções" value={String(detectionCount)} detail="Nesta sessão" tone="text-amber-600" icon={<Activity className="h-4 w-4" />} />
            <Stat label="Sistema" value={online ? 'Online' : 'Offline'} detail={online ? 'Recebendo atualizações' : 'Inicie o motor local'} tone="text-emerald-600" icon={<Wifi className="h-4 w-4" />} />
          </section>

          <section className="mb-7 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 shadow-sm"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><h2 className="font-semibold text-white">Feed ao vivo</h2><p className="mt-1 text-xs text-zinc-500">Detecções e identificadores do ByteTrack em tempo real</p></div><span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400"><span className={`h-1.5 w-1.5 rounded-full ${streamRunning ? 'bg-emerald-400' : 'bg-zinc-600'}`} />{streamRunning ? 'Motor conectado' : 'Aguardando stream'}</span></div><div className="relative flex aspect-video max-h-[520px] items-center justify-center overflow-hidden bg-[#10151a]">{streamRunning ? <><img src={`${ENGINE_URL}/stream/video`} alt="Feed ao vivo com detecções do motor de IA" className="absolute inset-0 h-full w-full object-contain" /><svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${frameSize.width} ${frameSize.height}`} preserveAspectRatio="xMidYMid meet">{detections.map((detection, index) => { const identified = detection.identification?.status === 'identified'; const color = identified ? '#5eead4' : '#fbbf24'; return <g key={detection.track_id ?? index}><rect x={detection.bbox.x * frameSize.width} y={detection.bbox.y * frameSize.height} width={detection.bbox.width * frameSize.width} height={detection.bbox.height * frameSize.height} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" /><rect x={detection.bbox.x * frameSize.width} y={detection.bbox.y * frameSize.height} width={frameSize.width * 0.34} height={frameSize.height * 0.06} rx={frameSize.height * 0.01} fill="#09090b" fillOpacity="0.86" /><text x={(detection.bbox.x + 0.014) * frameSize.width} y={(detection.bbox.y + 0.039) * frameSize.height} fill={color} fontSize={frameSize.height * 0.031} fontWeight="600">{detectionLabel(detection)}</text></g>; })}</svg><div aria-live="polite" className="pointer-events-none absolute right-4 top-4 rounded-md bg-black/70 px-3 py-2 text-xs font-medium text-zinc-200 shadow-lg shadow-black/20 backdrop-blur-sm">{detections.length === 0 ? 'Aguardando animal' : `${identifiedCount} identificado${identifiedCount === 1 ? '' : 's'} · ${detections.length} detectado${detections.length === 1 ? '' : 's'}`}</div></> : <div className="text-center"><Wifi className="mx-auto h-8 w-8 text-zinc-600" /><p className="mt-3 text-sm text-zinc-400">Inicie o monitoramento local para visualizar o feed</p></div>}<div className="absolute bottom-4 left-4 rounded-md bg-black/70 px-3 py-2 font-mono text-xs text-zinc-300">{engineMetrics.fps.toFixed(2)} FPS <span className="mx-1 text-zinc-600">|</span> {engineMetrics.latencyMs.toFixed(1)} ms</div></div></section>

          <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"><div className="flex flex-col gap-4 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-zinc-950">Eventos recentes</h2><p className="mt-1 text-xs text-zinc-500">Eventos detectados pelo sistema</p></div><div className="flex rounded-lg border border-zinc-200 p-0.5 text-[11px]"><button type="button" onClick={() => setFilter('all')} className={`rounded-md px-2.5 py-1.5 ${filter === 'all' ? 'bg-zinc-950 text-white' : 'text-zinc-500'}`}>Tudo</button><button type="button" onClick={() => setFilter('alerts')} className={`rounded-md px-2.5 py-1.5 ${filter === 'alerts' ? 'bg-zinc-950 text-white' : 'text-zinc-500'}`}>Alertas</button></div></div><div className="grid divide-y divide-zinc-100 md:grid-cols-2 md:divide-x md:divide-y-0">{visibleEvents.map((event) => <div key={event.id} className="flex gap-3 px-5 py-4"><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${event.kind === 'pet_detected' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}><EventIcon kind={event.kind} /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-zinc-800">{event.kind === 'pet_detected' ? 'Pet detectado' : 'Pet saiu do campo'}</p><time className="shrink-0 font-mono text-[10px] text-zinc-400">{formatClock(event.time)}</time></div><p className="mt-1 text-xs leading-5 text-zinc-500">{event.message}</p></div></div>)}{visibleEvents.length === 0 && <p className="col-span-full px-5 py-10 text-center text-sm text-zinc-500">Nenhum alerta neste período.</p>}</div><div className="border-t border-zinc-200 px-5 py-3 text-center text-[11px] text-zinc-400">Atualizado automaticamente a cada 3 segundos</div></section>

          <section className="mt-7 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"><div className="border-b border-zinc-200 px-5 py-4"><h2 className="font-semibold text-zinc-950">Histórico</h2><p className="mt-1 text-xs text-zinc-500">Registros desta sessão</p></div><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-zinc-50 text-[10px] uppercase tracking-[0.14em] text-zinc-400"><tr><th className="px-5 py-3 font-semibold">Horário</th><th className="px-5 py-3 font-semibold">Evento</th><th className="px-5 py-3 font-semibold">Ausência</th><th className="px-5 py-3 font-semibold">Estado</th></tr></thead><tbody>{events.slice(0, 5).map((event) => <tr key={`history-${event.id}`} className="border-t border-zinc-100"><td className="px-5 py-3.5 font-mono text-xs text-zinc-500">{formatClock(event.time)}</td><td className="px-5 py-3.5 text-xs font-medium text-zinc-700">{event.kind === 'pet_detected' ? 'Pet detectado' : 'Pet saiu do campo'}</td><td className="px-5 py-3.5 text-xs text-zinc-500">{event.duration}</td><td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1.5 text-xs font-medium ${event.kind === 'pet_detected' ? 'text-emerald-700' : 'text-amber-700'}`}>{event.kind === 'pet_detected' ? <Check className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}{event.kind === 'pet_detected' ? 'Seguro' : 'Aguardando'}</span></td></tr>)}{events.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-zinc-500">Ainda não há eventos nesta sessão.</td></tr>}</tbody></table></div></section>
          <footer className="py-6 text-xs text-zinc-400">Monitoramento local e privado</footer>
        </div>
      </div>
    </div>
  );
}
