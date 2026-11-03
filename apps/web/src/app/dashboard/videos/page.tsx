'use client';

import { useEffect, useRef, useState } from 'react';

type Detection = { confidence: number; bbox: { x: number; y: number; width: number; height: number } };
type Result = {
  duration_seconds: number; sample_interval_seconds: number;
  analyzed_frames: number; frames_with_dogs: number; max_dogs: number;
  presence_seconds: number; processing_seconds: number; processing_fps: number;
  samples: { time_seconds: number; detections: Detection[] }[];
  intervals: { start_seconds: number; end_seconds: number }[];
};
type Job = { id: string; status: string; progress: number; error?: string; result?: Result };
const formats: Record<string, string> = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', avi: 'video/x-msvideo' };
const clock = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;

export default function VideoAnalysisPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [time, setTime] = useState(0);
  const [videoAspectRatio, setVideoAspectRatio] = useState(16 / 9);
  const video = useRef<HTMLVideoElement>(null);
  const busy = uploading || (!!job && ['queued', 'processing', 'uploading'].includes(job.status));
  const result = job?.result;
  const sample = result?.samples[Math.floor((time + 0.00001) / result.sample_interval_seconds)];

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!job || !['queued', 'processing', 'uploading'].includes(job.status)) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    async function poll() {
      try {
        const response = await fetch(`/api/ai/videos?id=${job!.id}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? data.detail ?? 'Falha ao consultar análise.');
        failures = 0;
        setError('');
        setJob(data);
        if (data.status === 'failed') setError(data.error);
        if (['queued', 'processing', 'uploading'].includes(data.status)) timer = setTimeout(poll, 1500);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Falha de conexão.');
        if (++failures < 5) timer = setTimeout(poll, 3000);
        else setJob((current) => current ? { ...current, status: 'failed' } : null);
      }
    }
    timer = setTimeout(poll, 1000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [job?.id, job?.status]);

  async function analyze() {
    if (!file) return;
    setError(''); setJob(null); setUploading(true);
    try {
      const contentType = formats[file.name.split('.').pop()?.toLowerCase() ?? ''];
      if (!contentType) throw new Error('Selecione um vídeo MP4, WebM, MOV ou AVI.');
      if (!file.size || file.size > 200 * 1024 * 1024) throw new Error('Envie um vídeo de até 200 MB.');
      const response = await fetch('/api/ai/videos', { method: 'POST', headers: { 'Content-Type': contentType }, body: file });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? data.detail ?? 'Falha ao enviar vídeo.');
      setJob({ id: data.id, status: 'queued', progress: 0 });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao enviar vídeo.'); }
    finally { setUploading(false); }
  }

  function download(kind: 'json' | 'csv') {
    if (!result) return;
    const content = kind === 'json' ? JSON.stringify({ filename: file?.name, ...result }, null, 2)
      : ['tempo_segundos,cachorros,confianca_maxima', ...result.samples.map(s => `${s.time_seconds},${s.detections.length},${Math.max(0, ...s.detections.map(d => d.confidence))}`)].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: kind === 'json' ? 'application/json' : 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `analise-cachorros.${kind}`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-10">
    <div><h1 className="text-3xl font-semibold">Análise de vídeos</h1><p className="mt-2 text-muted-foreground">Envie um vídeo para localizar a presença de cachorros ao longo da gravação.</p></div>
    <section className="space-y-4 rounded-2xl border bg-card p-6">
      <label htmlFor="video-file" className="block font-medium">Vídeo para análise</label>
      <input id="video-file" type="file" accept=".mp4,.webm,.mov,.avi" disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); setJob(null); setError(''); setTime(0); }} className="block w-full rounded-lg border p-3" />
      <p className="text-sm text-muted-foreground">Até 200 MB, 10 minutos e resolução 4K. Prefira MP4/H.264 para reprodução no navegador.</p>
      <button disabled={!file || busy} onClick={analyze} className="rounded-xl bg-primary px-5 py-3 text-primary-foreground disabled:opacity-50">{uploading ? 'Enviando vídeo…' : busy ? 'Analisando…' : 'Analisar presença de cachorros'}</button>
      {busy && <div role="status" className="space-y-2"><p>{uploading ? 'Enviando arquivo ao motor de IA.' : `Análise em andamento: ${job?.progress ?? 0}%`}</p><progress className="w-full" max={100} value={uploading ? undefined : job?.progress ?? 0} /></div>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </section>
    {preview && <section className="space-y-3 rounded-2xl border bg-card p-6">
      <h2 className="text-xl font-semibold">{result ? 'Resultado na gravação' : 'Pré-visualização'}</h2>
      <div className="overflow-hidden rounded-xl bg-black">
      <div className="relative mx-auto" style={{ width: `min(100%, ${52 * videoAspectRatio}vh, ${480 * videoAspectRatio}px)` }}>
        <video ref={video} src={preview} controls className="block h-auto w-full" onLoadedMetadata={e => { const element = e.currentTarget; if (element.videoWidth > 0 && element.videoHeight > 0) setVideoAspectRatio(element.videoWidth / element.videoHeight); }} onTimeUpdate={e => setTime(e.currentTarget.currentTime)} onSeeked={e => setTime(e.currentTarget.currentTime)} onError={() => setError('O navegador não reproduziu este formato. A análise ainda pode funcionar; para visualizar, converta para MP4/H.264.')} />
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">{sample?.detections.map((d, i) => <div key={i} className="absolute border-2 border-green-400" style={{ left: `${d.bbox.x * 100}%`, top: `${d.bbox.y * 100}%`, width: `${d.bbox.width * 100}%`, height: `${d.bbox.height * 100}%` }}><span className="absolute left-0 top-0 bg-green-400 px-1 text-xs text-black">Cachorro {(d.confidence * 100).toFixed(0)}%</span></div>)}</div>
      </div>
      </div>
      {result && <p aria-live="polite" className="text-sm">{clock(time)} · {sample?.detections.length ?? 0} cachorro(s) detectado(s) na amostra.</p>}
    </section>}
    {result && <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Quadros analisados', result.analyzed_frames], ['Máximo simultâneo', result.max_dogs], ['Presença estimada', `${result.presence_seconds.toFixed(1)} s`], ['Processamento', `${result.processing_seconds.toFixed(1)} s`]].map(([label, value]) => <div key={label} className="rounded-2xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</section>
      <section className="space-y-4 rounded-2xl border bg-card p-6"><h2 className="text-xl font-semibold">Intervalos com cachorro detectado</h2>
        <p className="text-sm text-muted-foreground">Amostragem a cada {result.sample_interval_seconds.toFixed(2)} s. Os intervalos são estimativas de presença visual; trechos entre amostras podem conter ocorrências não detectadas. A confiança exibida é o escore do detector.</p>
        {!result.intervals.length && <p>Nenhum cachorro foi detectado nas amostras analisadas.</p>}
        <div className="flex flex-wrap gap-2">{result.intervals.map((interval, i) => <button key={i} className="rounded-lg border px-3 py-2 hover:bg-muted" onClick={() => { if (video.current) video.current.currentTime = interval.start_seconds; }}>{clock(interval.start_seconds)} — {clock(interval.end_seconds)}</button>)}</div>
        <div className="flex gap-3"><button onClick={() => download('json')} className="rounded-lg border px-4 py-2">Exportar relatório JSON</button><button onClick={() => download('csv')} className="rounded-lg border px-4 py-2">Exportar amostras CSV</button></div>
        <p className="text-sm text-muted-foreground">O relatório inclui caixas, escores, parâmetros e tempos. Os resultados ficam disponíveis por uma hora no motor e são perdidos ao reiniciá-lo. Exporte antes de sair desta tela.</p>
      </section>
    </>}
  </div>;
}
