'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Bell,
  Check,
  ChevronDown,
  Clock3,
  Dog,
  History,
  Home,
  LayoutDashboard,
  Pause,
  Play,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Video,
  Wifi,
} from 'lucide-react';

type EventKind = 'pet_detected' | 'pet_left';
type Filter = 'all' | 'alerts';
type EventItem = { id: number; kind: EventKind; time: Date; timeLabel?: string; message: string; duration: string };
type EngineStatus = { status: string; pet_present: boolean; sampling_rate?: string };

const ENGINE_URL = 'http://localhost:8000';
const mockEvents: EventItem[] = [
  { id: 1, kind: 'pet_detected', time: new Date('2026-08-29T10:58:00'), timeLabel: '10:58:00', message: 'Pet detected in the living room', duration: '--' },
  { id: 2, kind: 'pet_left', time: new Date('2026-08-29T10:42:00'), timeLabel: '10:42:00', message: 'Pet left the camera frame', duration: '16 min' },
  { id: 3, kind: 'pet_detected', time: new Date('2026-08-29T10:16:00'), timeLabel: '10:16:00', message: 'Pet detected in the living room', duration: '--' },
];

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

function StatusPill({ online, children }: { online: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${online ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-100 text-zinc-500'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
      {children}
    </span>
  );
}

function Stat({ label, value, detail, icon, tone = 'text-zinc-900' }: { label: string; value: string; detail: string; icon: React.ReactNode; tone?: string }) {
  return (
    <article className="flex min-h-28 items-start gap-4 border-b border-zinc-200 bg-white p-5 first:rounded-l-xl last:rounded-r-xl last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-50 ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{label}</p>
        <p className="mt-2 whitespace-nowrap text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">{value}</p>
        <p className="mt-1 truncate text-xs text-zinc-500">{detail}</p>
      </div>
    </article>
  );
}

function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-zinc-200 bg-white px-4 py-6 lg:flex">
      <div className="flex items-center gap-3 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950 text-white"><Dog className="h-4 w-4" /></span>
        <span className="text-sm font-semibold tracking-tight text-zinc-900">PetVision</span>
      </div>
      <div className="mt-12 rounded-lg border border-zinc-300 px-3 py-3 text-zinc-900 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-zinc-500"><div className="flex items-center gap-3 text-sm font-medium"><LayoutDashboard className="h-4 w-4" />Início</div><p className="mt-2 pl-7 text-[11px] text-zinc-500">Monitoramento da casa</p></div>
      <div className="mt-auto space-y-1">
        <button type="button" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"><SlidersHorizontal className="h-4 w-4" />Settings</button>
        <button type="button" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"><ShieldCheck className="h-4 w-4" />Privacy</button>
      </div>
    </aside>
  );
}

function WorkspaceTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: '/dashboard', label: 'Visão geral', icon: Home },
    { href: '/dashboard/test', label: 'Atividade', icon: Activity },
    { href: '/todos', label: 'Tarefas', icon: History },
  ] as const;

  return (
    <nav aria-label="Open workspace tabs" className="mb-7 flex items-center gap-1 overflow-x-auto border-b border-zinc-200">
      {tabs.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href as Route} aria-current={pathname === href ? 'page' : undefined} className={`-mb-px flex shrink-0 items-center gap-2 rounded-t-md border px-4 py-2.5 text-xs font-medium transition-[border-color,color,box-shadow] duration-200 ${pathname === href ? 'border-zinc-300 border-b-white bg-white text-zinc-950 shadow-sm' : 'border-transparent text-zinc-400 hover:border-zinc-300 hover:text-zinc-700'}`}>
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Link>
      ))}
      <span className="ml-auto hidden items-center gap-1 px-3 text-zinc-300 sm:flex"><span className="h-1 w-1 rounded-full bg-zinc-300" /><span className="h-1 w-1 rounded-full bg-zinc-300" /><span className="h-1 w-1 rounded-full bg-zinc-300" /></span>
    </nav>
  );
}

export default function DashboardRedesign() {
  const [online, setOnline] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [present, setPresent] = useState(true);
  const [lastSeen, setLastSeen] = useState<Date | null>(mockEvents[0].time);
  const [events, setEvents] = useState<EventItem[]>(mockEvents);
  const [filter, setFilter] = useState<Filter>('all');
  const [camera, setCamera] = useState('Living room camera');
  const [message, setMessage] = useState('');
  const previousPresence = useRef(present);
  const nextId = useRef(mockEvents.length + 1);

  async function pollStatus() {
    try {
      const response = await fetch(`${ENGINE_URL}/status`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Engine unavailable');
      const data = (await response.json()) as EngineStatus;
      setOnline(true);
      setPresent(data.pet_present);
      if (data.pet_present) setLastSeen(new Date());
      if (data.pet_present !== previousPresence.current) setEvents((current) => [{ id: nextId.current++, kind: data.pet_present ? 'pet_detected' : 'pet_left', time: new Date(), message: data.pet_present ? 'Pet detected in the living room' : 'Pet left the camera frame', duration: data.pet_present ? '--' : '5 min' }, ...current]);
      previousPresence.current = data.pet_present;
    } catch {
      setOnline(false);
    }
  }

  async function toggleMonitoring() {
    const action = monitoring ? 'stop' : 'start';
    try {
      const response = await fetch(`${ENGINE_URL}/stream/${action}`, { method: 'POST' });
      if (!response.ok) throw new Error('Command failed');
      setMonitoring(!monitoring);
      setMessage(monitoring ? 'Monitoring stopped.' : 'Monitoring started.');
    } catch {
      setMessage('Connect the FastAPI engine to control monitoring.');
    }
    window.setTimeout(() => setMessage(''), 3500);
  }

  useEffect(() => {
    void pollStatus();
    const interval = window.setInterval(() => void pollStatus(), 3000);
    return () => window.clearInterval(interval);
  }, []);

  const visibleEvents = useMemo(() => filter === 'alerts' ? events.filter((event) => event.kind === 'pet_left') : events, [events, filter]);
  const detectionCount = events.filter((event) => event.kind === 'pet_detected').length;
  const lastEvent = events[0];

  return (
    <main className="min-h-screen bg-[#f5f5f3] text-zinc-900">
      <div className="mx-auto flex min-h-[calc(100vh-65px)] max-w-[1600px]">
        <Sidebar />
        <div className="min-w-0 flex-1 px-5 py-7 sm:px-8 lg:px-10">
          <header className="mb-8 flex flex-col gap-5 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-zinc-950">Good morning, keep an eye on home.</h1>
              <p className="mt-2 text-sm text-zinc-500">A quiet overview of your pet's presence today.</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="relative flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 shadow-sm"><Video className="h-4 w-4 text-zinc-400" /><select value={camera} onChange={(event) => setCamera(event.target.value)} className="appearance-none bg-transparent pr-5 outline-none"><option>Living room camera</option><option>Backyard camera</option><option>Hallway camera</option></select><ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-zinc-400" /></label>
              <StatusPill online={online && monitoring}>{online && monitoring ? 'Live' : 'Offline'}</StatusPill>
              <button type="button" aria-label="Dashboard settings" className="rounded-lg border border-zinc-200 bg-white p-2 text-zinc-500 shadow-sm transition hover:border-zinc-400 hover:text-zinc-950"><Settings2 className="h-4 w-4" /></button>
            </div>
          </header>

          <WorkspaceTabs />

          <section className="mb-7 grid overflow-hidden rounded-xl border border-zinc-200 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Pet status" value={present ? 'Present' : 'Absent'} detail={present ? 'Safe and visible in frame' : 'No pet detected recently'} tone={present ? 'text-emerald-600' : 'text-rose-500'} icon={<span className={`h-2.5 w-2.5 rounded-full ${present ? 'bg-emerald-500' : 'bg-rose-500'}`} />} />
            <Stat label="Last seen" value={relativeTime(lastSeen)} detail={lastEvent ? `${lastEvent.timeLabel ?? formatClock(lastEvent.time)} · ${camera}` : 'No activity'} tone="text-sky-600" icon={<Clock3 className="h-4 w-4" />} />
            <Stat label="Detections today" value={String(detectionCount)} detail="Arrival events this session" tone="text-amber-600" icon={<Activity className="h-4 w-4" />} />
            <Stat label="System health" value={online ? 'Healthy' : 'Standby'} detail={online ? 'Engine connected · 2 FPS' : 'Waiting for local engine'} tone="text-emerald-600" icon={<Wifi className="h-4 w-4" />} />
          </section>

          <section className="grid gap-7 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
            <article className="min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-zinc-950">Live camera</h2><p className="mt-1 text-xs text-zinc-500">{camera} · 2 FPS</p></div><StatusPill online={monitoring}>{monitoring ? 'Live feed' : 'Paused'}</StatusPill></div>
              <div id="live-camera" className="relative aspect-video overflow-hidden bg-zinc-950">{monitoring && <img src={`${ENGINE_URL}/stream/video`} alt="Live camera feed" className="absolute inset-0 h-full w-full object-cover" />}<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_52%)]" />{!monitoring && <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white"><Video className="h-6 w-6" /></div><p className="text-sm font-medium text-white">Camera feed paused</p><p className="mt-2 max-w-xs text-xs text-zinc-400">{online ? 'Start monitoring to view the camera.' : 'Start the local AI engine to connect this camera.'}</p></div>}<div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-md bg-black/60 px-3 py-2 text-xs text-white backdrop-blur"><span className={`h-1.5 w-1.5 rounded-full ${monitoring ? 'bg-emerald-400' : 'bg-zinc-500'}`} />{camera}</div><span className="absolute bottom-4 right-4 rounded-md bg-black/60 px-3 py-2 font-mono text-[10px] text-zinc-300 backdrop-blur">02 FPS</span></div>
              <div className="flex flex-col gap-4 border-t border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-zinc-900">{present ? 'Your pet is in view' : 'No pet in view'}</p><p className="mt-1 text-xs text-zinc-500">{present ? 'The latest frame looks safe.' : 'We will notify you when they return.'}</p></div><button type="button" onClick={() => void toggleMonitoring()} className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${monitoring ? 'border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400' : 'bg-zinc-950 text-white hover:bg-zinc-800'}`}>{monitoring ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}{monitoring ? 'Pause monitoring' : 'Start monitoring'}</button></div>
            </article>

            <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4"><div><h2 className="font-semibold text-zinc-950">Recent activity</h2><p className="mt-1 text-xs text-zinc-500">Events from this session</p></div><div className="flex rounded-lg border border-zinc-200 p-0.5 text-[11px]"><button type="button" onClick={() => setFilter('all')} className={`rounded-md px-2.5 py-1.5 ${filter === 'all' ? 'bg-zinc-950 text-white' : 'text-zinc-500'}`}>All</button><button type="button" onClick={() => setFilter('alerts')} className={`rounded-md px-2.5 py-1.5 ${filter === 'alerts' ? 'bg-zinc-950 text-white' : 'text-zinc-500'}`}>Alerts</button></div></div><div className="max-h-[425px] overflow-y-auto px-5">{visibleEvents.map((event) => <div key={event.id} className="flex gap-3 border-b border-zinc-100 py-4 last:border-0"><div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${event.kind === 'pet_detected' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}><EventIcon kind={event.kind} /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-sm font-medium text-zinc-800">{event.kind === 'pet_detected' ? 'Pet detected' : 'Pet left'}</p><time className="shrink-0 font-mono text-[10px] text-zinc-400">{event.timeLabel ?? formatClock(event.time)}</time></div><p className="mt-1 text-xs leading-5 text-zinc-500">{event.message}</p></div></div>)}{visibleEvents.length === 0 && <p className="py-10 text-center text-sm text-zinc-500">No alerts in this period.</p>}</div><div className="border-t border-zinc-200 px-5 py-3 text-center text-[11px] text-zinc-400">Updates automatically every 3 seconds</div></article>
          </section>

          <section className="mt-7 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4"><div><h2 className="font-semibold text-zinc-950">History</h2><p className="mt-1 text-xs text-zinc-500">Recorded activity from this session</p></div><button type="button" className="text-xs font-medium text-zinc-500 transition hover:text-zinc-950">View all</button></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-zinc-50 text-[10px] uppercase tracking-[0.14em] text-zinc-400"><tr><th className="px-5 py-3 font-semibold">Time</th><th className="px-5 py-3 font-semibold">Event type</th><th className="px-5 py-3 font-semibold">Duration absent</th><th className="px-5 py-3 font-semibold">Status</th></tr></thead><tbody>{events.slice(0, 5).map((event) => <tr key={`history-${event.id}`} className="border-t border-zinc-100"><td className="px-5 py-3.5 font-mono text-xs text-zinc-500">{event.timeLabel ?? formatClock(event.time)}</td><td className="px-5 py-3.5"><span className={`inline-flex items-center gap-2 text-xs font-medium ${event.kind === 'pet_detected' ? 'text-emerald-700' : 'text-rose-600'}`}><span className={`h-1.5 w-1.5 rounded-full ${event.kind === 'pet_detected' ? 'bg-emerald-500' : 'bg-rose-500'}`} />{event.kind === 'pet_detected' ? 'Pet detected' : 'Pet left'}</span></td><td className="px-5 py-3.5 text-xs text-zinc-500">{event.duration}</td><td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1.5 text-xs font-medium ${event.kind === 'pet_detected' ? 'text-emerald-700' : 'text-amber-700'}`}>{event.kind === 'pet_detected' ? <Check className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}{event.kind === 'pet_detected' ? 'Safe' : 'Monitoring'}</span></td></tr>)}</tbody></table></div></section>
          <footer className="flex items-center justify-between py-6 text-xs text-zinc-400"><span>PetVision AI · Private local monitoring</span><span>{message || 'All systems operational'}</span></footer>
        </div>
      </div>
    </main>
  );
}
