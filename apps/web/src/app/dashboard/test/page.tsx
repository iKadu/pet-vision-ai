'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  CircleDot,
  Play,
  RefreshCw,
  Square,
  Trash2,
} from 'lucide-react';

type EventType = 'pet_detected' | 'pet_left' | 'system';

type EngineStatus = {
  status: string;
  pet_present: boolean;
  pet_count?: number;
  last_seen?: string | number | null;
  sampling_rate?: string;
};

type EventLog = {
  id: number;
  timestamp: Date;
  type: EventType;
  message: string;
  details?: Record<string, unknown>;
};

type Notice = {
  tone: 'success' | 'error';
  message: string;
};

const ENGINE_URL = 'http://localhost:8000';
const POLL_INTERVAL = 2500;

const initialLogs: EventLog[] = [];

function formatTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function relativeTime(value: Date | null) {
  if (!value) return 'No detection recorded';
  const seconds = Math.max(0, Math.floor((Date.now() - value.getTime()) / 1000));
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}

function parseLastSeen(value: EngineStatus['last_seen']) {
  if (!value) return null;
  const date = typeof value === 'number'
    ? new Date(value < 1_000_000_000_000 ? value * 1000 : value)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function TestDashboardPage() {
  const [engineOnline, setEngineOnline] = useState(false);
  const [streamRunning, setStreamRunning] = useState(false);
  const [petPresent, setPetPresent] = useState(false);
  const [petCount, setPetCount] = useState(0);
  const [lastSeen, setLastSeen] = useState<Date | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [logs, setLogs] = useState<EventLog[]>(initialLogs);
  const [notice, setNotice] = useState<Notice | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const previousPresence = useRef(false);
  const nextLogId = useRef(initialLogs.length + 1);

  function addLog(type: EventType, message: string, details?: Record<string, unknown>) {
    setLogs((current) => [
      ...current,
      { id: nextLogId.current++, timestamp: new Date(), type, message, details },
    ]);
  }

  function showNotice(nextNotice: Notice) {
    setNotice(nextNotice);
    window.setTimeout(() => setNotice(null), 3500);
  }

  async function readStatus() {
    try {
      const response = await fetch(`${ENGINE_URL}/status`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = (await response.json()) as EngineStatus;
      const presenceChanged = data.pet_present !== previousPresence.current;
      const detectedAt = parseLastSeen(data.last_seen) ?? (data.pet_present ? new Date() : null);

      setEngineOnline(true);
      setPetPresent(data.pet_present);
      setPetCount(data.pet_count ?? (data.pet_present ? 1 : 0));
      if (detectedAt) setLastSeen(detectedAt);
      setLastUpdated(new Date());

      if (presenceChanged && previousPresence.current !== undefined) {
        addLog(
          data.pet_present ? 'pet_detected' : 'pet_left',
          data.pet_present ? 'Pet identified in the environment.' : 'Pet is no longer visible in the frame.',
          { total_pets: data.pet_count ?? (data.pet_present ? 1 : 0), source: 'webcam_0' },
        );
      }
      previousPresence.current = data.pet_present;
    } catch {
      setEngineOnline(false);
      setPetCount(0);
    }
  }

  async function controlStream(action: 'start' | 'stop') {
    try {
      const response = await fetch(`${ENGINE_URL}/stream/${action}`, { method: 'POST' });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      setStreamRunning(action === 'start');
      showNotice({
        tone: 'success',
        message: action === 'start' ? 'Stream monitoring started.' : 'Stream monitoring stopped.',
      });
      addLog('system', action === 'start' ? 'Stream start command accepted.' : 'Stream stop command accepted.');
      await readStatus();
    } catch {
      showNotice({ tone: 'error', message: 'FastAPI engine is unreachable. Using mock state.' });
      addLog('system', `Could not ${action} stream. Engine offline.`);
    }
  }

  useEffect(() => {
    addLog('system', 'Developer monitor ready. Waiting for FastAPI engine.');
    void readStatus();
    const interval = window.setInterval(() => void readStatus(), POLL_INTERVAL);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-5 border-b border-zinc-800 pb-6 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Pet Vision / Developer Tools
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Engine test dashboard</h1>
            <p className="mt-2 text-sm text-zinc-500">Control the local AI stream and inspect presence events as they arrive.</p>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-zinc-500">
            <span className="h-2 w-2 rounded-full bg-zinc-600" />
            {lastUpdated ? `polled ${formatTime(lastUpdated)}` : 'connecting'}
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6">
            <div className="mb-8 flex items-start justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">01 / engine control</p>
                <h2 className="mt-2 text-xl font-medium text-white">FastAPI stream</h2>
              </div>
              <div className={`flex items-center gap-2 border px-3 py-1.5 text-xs font-medium ${engineOnline ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/30 bg-amber-400/10 text-amber-300'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${engineOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                {engineOnline ? 'Online' : 'Offline / mock'}
              </div>
            </div>
            <div className="mb-8 flex items-center gap-3 border-l-2 border-zinc-700 pl-4">
              <Activity className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-sm text-zinc-300">{streamRunning ? 'Stream is actively monitoring' : 'Stream is currently stopped'}</p>
                <p className="mt-1 font-mono text-xs text-zinc-600">GET {ENGINE_URL}/status</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void controlStream('start')} disabled={!engineOnline || streamRunning} className="inline-flex items-center gap-2 bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-35">
                <Play className="h-4 w-4 fill-current" /> Start Stream
              </button>
              <button type="button" onClick={() => void controlStream('stop')} disabled={!engineOnline || !streamRunning} className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-35">
                <Square className="h-4 w-4 fill-current" /> Stop Stream
              </button>
              <button type="button" onClick={() => void readStatus()} aria-label="Refresh engine status" className="ml-auto inline-flex items-center gap-2 border border-zinc-800 px-3 py-2.5 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white">
                <RefreshCw className="h-4 w-4" /> <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </article>

          <article className="border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">02 / live status</p>
                <h2 className="mt-2 text-xl font-medium text-white">Presence snapshot</h2>
              </div>
              <CircleDot className={`h-5 w-5 ${petPresent ? 'text-emerald-400' : 'text-zinc-600'}`} />
            </div>
            <div className="mb-7 flex items-center justify-between border-b border-zinc-800 pb-6">
              <span className="text-sm text-zinc-500">Pet presence</span>
              <span className={`px-2.5 py-1 text-xs font-bold tracking-wider ${petPresent ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}>
                {petPresent ? 'PRESENT' : 'ABSENT'}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-5">
              <div><dt className="text-xs text-zinc-500">Last seen</dt><dd className="mt-1 text-sm text-zinc-200">{relativeTime(lastSeen)}</dd></div>
              <div><dt className="text-xs text-zinc-500">Active detections</dt><dd className="mt-1 font-mono text-2xl text-white">{petCount}</dd></div>
            </dl>
          </article>
        </section>

        <section className="mt-5 border border-zinc-800 bg-black">
          <div className="flex flex-col gap-3 border-b border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3"><span className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">03 / webhook events</span><span className="h-1 w-1 rounded-full bg-zinc-700" /><span className="font-mono text-xs text-zinc-600">{logs.length} entries</span></div>
            <button type="button" onClick={() => setLogs([])} className="inline-flex w-fit items-center gap-2 text-xs text-zinc-500 transition hover:text-zinc-200"><Trash2 className="h-3.5 w-3.5" /> Clear logs</button>
          </div>
          <div className="h-72 overflow-y-auto p-5 font-mono text-xs leading-6 sm:h-80">
            {logs.length === 0 && <p className="text-zinc-700">No events in buffer.</p>}
            {logs.map((log) => (
              <div key={log.id} className="grid grid-cols-[auto_auto_1fr] gap-x-3">
                <span className="text-zinc-600">{formatTime(log.timestamp)}</span>
                <span className={log.type === 'pet_detected' ? 'text-emerald-400' : log.type === 'pet_left' ? 'text-orange-400' : 'text-zinc-500'}>{log.type}</span>
                <span className="break-words text-zinc-300">{log.message}{log.details && <span className="text-zinc-600">{' '}{JSON.stringify(log.details)}</span>}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </section>

        <footer className="mt-4 flex items-center gap-2 text-xs text-zinc-600"><AlertTriangle className="h-3.5 w-3.5 text-amber-500/70" /> API unavailable? Controls are disabled and the dashboard remains in mock mode.</footer>
      </div>
      {notice && <div role="status" className={`fixed bottom-5 right-5 flex max-w-sm items-center gap-3 border px-4 py-3 text-sm shadow-2xl ${notice.tone === 'success' ? 'border-emerald-400/30 bg-zinc-900 text-emerald-200' : 'border-amber-400/30 bg-zinc-900 text-amber-200'}`}>{notice.tone === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{notice.message}</div>}
    </main>
  );
}
