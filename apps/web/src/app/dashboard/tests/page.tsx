'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, CircleAlert, Clock3, Download, FileImage, FileVideo, ImageUp, LoaderCircle, PawPrint, Play, ScanSearch, Sparkles, UploadCloud, Video, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ComponentType, type RefObject } from 'react';

import { trpc } from '@/utils/trpc';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES: Record<string, string> = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', avi: 'video/x-msvideo' };
const ACTIVE_JOB_STATUSES = ['queued', 'processing', 'uploading'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;

type Mode = 'image' | 'video';
type MatchCandidate = { petId: string; petName: string; similarity: number };
type MatchResult = { threshold: number; marginThreshold: number; margin: number | null; candidate: MatchCandidate | null; runnerUp: MatchCandidate | null; match: MatchCandidate | null; possibleMatch: MatchCandidate | null };
type Detection = { confidence: number; bbox: { x: number; y: number; width: number; height: number } };
type VideoResult = { duration_seconds: number; sample_interval_seconds: number; analyzed_frames: number; frames_with_dogs: number; max_dogs: number; presence_seconds: number; processing_seconds: number; processing_fps: number; samples: { time_seconds: number; detections: Detection[] }[]; intervals: { start_seconds: number; end_seconds: number }[] };
type VideoJob = { id: string; status: string; progress: number; error?: string; result?: VideoResult };

const percentage = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(value);
const clock = (seconds: number) => Math.floor(seconds / 60).toString().padStart(2, '0') + ':' + (seconds % 60).toFixed(1).padStart(4, '0');

export default function MediaAnalysisPage() {
  const [mode, setMode] = useState<Mode>('image');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState('');
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [videoJob, setVideoJob] = useState<VideoJob | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [error, setError] = useState('');
  const [time, setTime] = useState(0);
  const [videoAspectRatio, setVideoAspectRatio] = useState(16 / 9);
  const videoElement = useRef<HTMLVideoElement>(null);
  const petsQuery = useQuery(trpc.pets.list.queryOptions());
  const referencesQuery = useQuery(trpc.pets.listEmbeddingReferences.queryOptions());
  const referencePetIds = useMemo(() => new Set(referencesQuery.data?.map((reference) => reference.petId) ?? []), [referencesQuery.data]);
  const readyPets = petsQuery.data?.filter((pet) => referencePetIds.has(pet.id)) ?? [];
  const result = videoJob?.result;
  const videoBusy = isUploadingVideo || Boolean(videoJob && ACTIVE_JOB_STATUSES.includes(videoJob.status));
  const busy = mode === 'image' ? isAnalyzingImage : videoBusy;
  const activeFile = mode === 'image' ? imageFile : videoFile;
  const activePreview = mode === 'image' ? imagePreview : videoPreview;
  const sample = result?.samples[Math.floor((time + 0.00001) / result.sample_interval_seconds)];

  useEffect(() => {
    if (!imageFile) { setImagePreview(null); return; }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    if (!videoFile) { setVideoPreview(''); return; }
    const url = URL.createObjectURL(videoFile);
    setVideoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  useEffect(() => {
    if (!videoJob || !ACTIVE_JOB_STATUSES.includes(videoJob.status)) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    async function poll() {
      try {
        const response = await fetch('/api/ai/videos?id=' + videoJob!.id, { signal: controller.signal });
        const data = await response.json() as VideoJob & { error?: string };
        if (!response.ok) throw new Error(data.error ?? 'Falha ao consultar a análise do vídeo.');
        failures = 0;
        setError('');
        setVideoJob(data);
        if (data.status === 'failed') setError(data.error ?? 'A análise do vídeo falhou.');
        if (ACTIVE_JOB_STATUSES.includes(data.status)) timer = setTimeout(poll, 1500);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Falha de conexão com a análise do vídeo.');
        if (++failures < 5) timer = setTimeout(poll, 3000);
        else setVideoJob((current) => current ? { ...current, status: 'failed' } : null);
      }
    }
    timer = setTimeout(poll, 1000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [videoJob?.id, videoJob?.status]);

  function selectImage(file: File | null) {
    setMatchResult(null);
    setError('');
    if (!file) { setImageFile(null); return; }
    if (!IMAGE_TYPES.includes(file.type) || !file.size || file.size > MAX_IMAGE_SIZE) { setImageFile(null); setError('Use uma foto JPG, PNG ou WEBP de até 5 MB.'); return; }
    setImageFile(file);
  }

  function selectVideo(file: File | null) {
    setVideoJob(null);
    setTime(0);
    setError('');
    if (!file) { setVideoFile(null); return; }
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!VIDEO_TYPES[extension] || !file.size || file.size > MAX_VIDEO_SIZE) { setVideoFile(null); setError('Selecione um vídeo MP4, WebM, MOV ou AVI de até 200 MB.'); return; }
    setVideoFile(file);
  }

  async function identifyPet() {
    if (!imageFile || isAnalyzingImage) return;
    setError('');
    setMatchResult(null);
    setIsAnalyzingImage(true);
    try {
      const response = await fetch('/api/pets/matches', { method: 'POST', headers: { 'content-type': imageFile.type }, body: imageFile });
      const body = await response.json() as MatchResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Não foi possível identificar o animal pela foto.');
      setMatchResult(body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível identificar o animal pela foto.'); }
    finally { setIsAnalyzingImage(false); }
  }

  async function analyzeVideo() {
    if (!videoFile || videoBusy) return;
    setError('');
    setVideoJob(null);
    setIsUploadingVideo(true);
    try {
      const extension = videoFile.name.split('.').pop()?.toLowerCase() ?? '';
      const response = await fetch('/api/ai/videos', { method: 'POST', headers: { 'Content-Type': VIDEO_TYPES[extension] }, body: videoFile });
      const data = await response.json() as { id?: string; error?: string; detail?: string };
      if (!response.ok || !data.id) throw new Error(data.error ?? data.detail ?? 'Falha ao enviar vídeo.');
      setVideoJob({ id: data.id, status: 'queued', progress: 0 });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao enviar vídeo.'); }
    finally { setIsUploadingVideo(false); }
  }

  function download(kind: 'json' | 'csv') {
    if (!result) return;
    const content = kind === 'json'
      ? JSON.stringify({ filename: videoFile?.name, ...result }, null, 2)
      : ['tempo_segundos,cachorros,confianca_maxima', ...result.samples.map((item) => item.time_seconds + ',' + item.detections.length + ',' + Math.max(0, ...item.detections.map((detection) => detection.confidence)))].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: kind === 'json' ? 'application/json' : 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'analise-cachorros.' + kind;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="min-h-screen text-foreground">
    <div className="mx-auto max-w-[1400px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
      <header className="flex flex-col gap-5 border-b border-border/80 pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Laboratório PetVision</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-foreground sm:text-4xl">Análise de mídia</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Teste a identificação por imagem ou acompanhe a presença de cachorros em uma gravação, no mesmo espaço de trabalho.</p></div>
        <div className="flex items-center gap-2 rounded-2xl border border-border/80 bg-card/70 p-1.5" role="tablist" aria-label="Tipo de análise"><ModeButton active={mode === 'image'} onClick={() => { setMode('image'); setError(''); }} icon={<ImageUp className="h-4 w-4" />} label="Imagem" /><ModeButton active={mode === 'video'} onClick={() => { setMode('video'); setError(''); }} icon={<Video className="h-4 w-4" />} label="Vídeo" /></div>
      </header>

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
        <section className="rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6">
          <div className="flex items-start gap-3 border-b border-border/80 pb-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">{mode === 'image' ? <ImageUp className="h-5 w-5" /> : <Video className="h-5 w-5" />}</span><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">{mode === 'image' ? 'Identificação por imagem' : 'Detecção em gravação'}</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-card-foreground">{mode === 'image' ? 'Compare uma foto com os perfis cadastrados' : 'Encontre momentos com cachorro no vídeo'}</h2></div></div>
          <label htmlFor={mode + '-analysis-file'} className="group mt-6 flex min-h-[310px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-surface-raised/60 p-5 text-center transition hover:border-primary/55 hover:bg-accent/45">
            {activePreview ? mode === 'image' ? <img src={imagePreview ?? ''} alt="Prévia da foto enviada para teste" className="max-h-[420px] w-full rounded-xl object-contain" /> : <div className="relative w-full max-w-2xl overflow-hidden rounded-xl bg-black"><video src={videoPreview} controls className="block max-h-[420px] w-full" onClick={(event) => event.stopPropagation()} onLoadedMetadata={(event) => { const element = event.currentTarget; if (element.videoWidth > 0 && element.videoHeight > 0) setVideoAspectRatio(element.videoWidth / element.videoHeight); }} /><span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white backdrop-blur"><Play className="h-3 w-3" />Prévia</span></div> : <><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-primary shadow-sm transition-transform group-hover:scale-105">{mode === 'image' ? <FileImage className="h-5 w-5" /> : <FileVideo className="h-5 w-5" />}</span><p className="mt-4 text-sm font-semibold text-card-foreground">{mode === 'image' ? 'Escolher uma foto' : 'Escolher uma gravação'}</p><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{mode === 'image' ? 'Use uma imagem nítida e bem iluminada, com o cachorro visível.' : 'Envie uma gravação de até 10 minutos para analisar a presença visual.'}</p><span className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-sm"><UploadCloud className="h-4 w-4 text-primary" />Selecionar arquivo</span></>}
            <input id={mode + '-analysis-file'} type="file" accept={mode === 'image' ? 'image/jpeg,image/png,image/webp' : '.mp4,.webm,.mov,.avi'} disabled={busy} className="sr-only" onChange={(event) => { if (mode === 'image') selectImage(event.target.files?.[0] ?? null); else selectVideo(event.target.files?.[0] ?? null); event.target.value = ''; }} />
          </label>
          {activeFile && <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/55 px-3 py-2.5"><p className="min-w-0 truncate text-xs text-muted-foreground">{activeFile.name} · {(activeFile.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB</p><button type="button" onClick={() => mode === 'image' ? selectImage(null) : selectVideo(null)} disabled={busy} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-surface-raised hover:text-foreground disabled:opacity-50" aria-label={'Remover ' + (mode === 'image' ? 'foto' : 'vídeo')}><X className="h-4 w-4" /></button></div>}
          {error && <p role="alert" className="mt-5 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-3 py-3 text-xs leading-5 text-destructive">{error}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border/80 pt-5"><button type="button" onClick={() => mode === 'image' ? void identifyPet() : void analyzeVideo()} disabled={!activeFile || busy || (mode === 'image' && !readyPets.length)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_8px_18px_color-mix(in_oklch,var(--primary)_18%,transparent)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40">{busy ? <><LoaderCircle className="h-4 w-4 animate-spin" />{mode === 'image' ? 'Analisando foto...' : isUploadingVideo ? 'Enviando vídeo...' : 'Analisando... ' + (videoJob?.progress ?? 0) + '%'}</> : <><ScanSearch className="h-4 w-4" />{mode === 'image' ? 'Identificar cachorro' : 'Analisar vídeo'}</>}</button><p className="text-xs leading-5 text-muted-foreground">{mode === 'image' ? 'JPG, PNG ou WEBP de até 5 MB.' : 'MP4, WebM, MOV ou AVI de até 200 MB.'}</p></div>
          {videoBusy && <div role="status" className="mt-4 rounded-xl border border-primary/15 bg-primary/[0.05] p-3"><div className="flex items-center justify-between gap-3 text-xs"><span className="font-medium text-foreground">{isUploadingVideo ? 'Enviando arquivo ao motor de IA' : 'Análise em andamento'}</span><span className="font-semibold text-primary">{isUploadingVideo ? '...' : (videoJob?.progress ?? 0) + '%'}</span></div><progress className="mt-2 h-1.5 w-full accent-primary" max={100} value={isUploadingVideo ? undefined : videoJob?.progress ?? 0} /></div>}
        </section>
        {mode === 'image' ? <ProfilesAside pets={petsQuery.data ?? []} readyPetIds={referencePetIds} readyPetsCount={readyPets.length} isLoading={petsQuery.isPending || referencesQuery.isPending} /> : <VideoGuideAside result={result} />}
      </div>
      {mode === 'image' && matchResult && <ImageResult result={matchResult} />}
      {mode === 'video' && videoPreview && <VideoPreviewResult videoElement={videoElement} videoPreview={videoPreview} videoAspectRatio={videoAspectRatio} time={time} setTime={setTime} result={result} sample={sample} setError={setError} />}
      {mode === 'video' && result && <VideoResultDetails result={result} videoElement={videoElement} download={download} />}
    </div>
  </div>;
}

function ModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={'inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-xs font-semibold transition ' + (active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground')}>{icon}{label}</button>;
}

function ProfilesAside({ pets, readyPetIds, readyPetsCount, isLoading }: { pets: { id: string; name: string }[]; readyPetIds: Set<string>; readyPetsCount: number; isLoading: boolean }) {
  return <aside className="self-start rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><PawPrint className="h-5 w-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Base de comparação</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Perfis disponíveis</h2></div></div>{isLoading ? <div className="mt-5 space-y-3">{[0, 1].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-surface-raised" />)}</div> : !pets.length ? <div className="mt-5 rounded-2xl border border-dashed border-border bg-background/55 px-4 py-6 text-center"><CircleAlert className="mx-auto h-5 w-5 text-primary" /><p className="mt-3 text-sm font-semibold text-card-foreground">Nenhum animal cadastrado</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Cadastre um cachorro e inclua fotos de referência antes de testar.</p><Link href="/dashboard/animals/new" className="mt-4 inline-flex text-xs font-semibold text-primary hover:text-primary-hover">Cadastrar animal</Link></div> : <><p className="mt-5 text-xs leading-5 text-muted-foreground">{readyPetsCount} de {pets.length} perfis prontos para comparação.</p><div className="mt-4 space-y-2">{pets.map((pet) => { const ready = readyPetIds.has(pet.id); return <div key={pet.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/45 px-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-card-foreground">{pet.name}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{ready ? 'Pronto para comparação' : 'Sem foto de referência'}</p></div><span className={'h-2.5 w-2.5 shrink-0 rounded-full ' + (ready ? 'bg-success' : 'bg-muted-foreground/35')} /></div>; })}</div>{!readyPetsCount && <p className="mt-4 rounded-xl border border-warning/25 bg-warning/[0.07] px-3 py-3 text-xs leading-5 text-foreground">Adicione ao menos uma foto de referência a um perfil para habilitar a identificação.</p>}</>}</aside>;
}

function VideoGuideAside({ result }: { result?: VideoResult }) {
  const items: Array<[string, string]> = result ? [['Duração analisada', result.duration_seconds.toFixed(1) + ' s'], ['Quadros avaliados', String(result.analyzed_frames)], ['Cachorros detectados', String(result.frames_with_dogs)], ['FPS de processamento', result.processing_fps.toFixed(1)]] : [['Formato', 'MP4, WebM, MOV ou AVI'], ['Limite', 'Até 200 MB'], ['Amostragem', 'Intervalos automáticos'], ['Saída', 'Caixas e relatório']];
  return <aside className="self-start rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><Sparkles className="h-5 w-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Análise em vídeo</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-card-foreground">{result ? 'Resumo da execução' : 'Como funciona'}</h2></div></div><div className="mt-5 space-y-2">{items.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/45 px-3 py-3"><span className="text-xs text-muted-foreground">{label}</span><span className="text-right text-xs font-semibold text-card-foreground">{value}</span></div>)}</div><p className="mt-4 text-xs leading-5 text-muted-foreground">O processamento gera amostras com caixas de detecção e estima os intervalos em que havia um cachorro no quadro.</p></aside>;
}

function ImageResult({ result }: { result: MatchResult }) {
  const identifiedPet = result.match;
  const possiblePet = result.possibleMatch;
  const candidate = identifiedPet ?? possiblePet ?? result.candidate;
  return <section aria-live="polite" className="mt-6 rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6">{identifiedPet ? <ResultHeader icon={<CheckCircle2 className="h-5 w-5" />} tone="success" eyebrow="Identificação confirmada" title={'Este cachorro corresponde a ' + identifiedPet.petName} detail={'Similaridade visual de ' + percentage(identifiedPet.similarity) + ', acima do limiar de ' + percentage(result.threshold) + '.'} /> : possiblePet ? <ResultHeader icon={<CircleAlert className="h-5 w-5" />} tone="warning" eyebrow="Possível correspondência" title={'A foto se parece com ' + possiblePet.petName} detail={'A similaridade de ' + percentage(possiblePet.similarity) + ' atingiu o limiar, mas a diferença para outro perfil é pequena. Tente uma foto mais nítida ou adicione referências em outros ângulos.'} /> : candidate ? <ResultHeader icon={<CircleAlert className="h-5 w-5" />} tone="warning" eyebrow="Não identificado" title="Nenhum perfil atingiu o nível de confiança" detail={'O perfil mais próximo foi ' + candidate.petName + ', com similaridade de ' + percentage(candidate.similarity) + '. O mínimo configurado é ' + percentage(result.threshold) + '.'} /> : <ResultHeader icon={<CircleAlert className="h-5 w-5" />} tone="warning" eyebrow="Sem correspondências" title="Não há referências compatíveis para comparar" detail="Verifique se os animais cadastrados possuem fotos de referência processadas." />}{result.runnerUp && <p className="mt-5 border-t border-border/80 pt-4 text-xs leading-5 text-muted-foreground">Segundo perfil mais próximo: {result.runnerUp.petName} ({percentage(result.runnerUp.similarity)}). Margem entre os perfis: {result.margin === null ? 'não se aplica' : percentage(result.margin)}; mínimo: {percentage(result.marginThreshold)}.</p>}</section>;
}

function VideoPreviewResult({ videoElement, videoPreview, videoAspectRatio, time, setTime, result, sample, setError }: { videoElement: RefObject<HTMLVideoElement | null>; videoPreview: string; videoAspectRatio: number; time: number; setTime: (value: number) => void; result?: VideoResult; sample?: VideoResult['samples'][number]; setError: (value: string) => void }) {
  return <section className="mt-6 rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6"><div className="flex items-center justify-between gap-3 border-b border-border/80 pb-5"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">{result ? 'Resultado na gravação' : 'Pré-visualização'}</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-card-foreground">{result ? 'Detecções sincronizadas com o vídeo' : 'Revise o arquivo antes de analisar'}</h2></div><span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-foreground"><Video className="h-3 w-3" />Vídeo</span></div><div className="mt-5 overflow-hidden rounded-2xl bg-black"><div className="relative mx-auto" style={{ width: 'min(100%, ' + (52 * videoAspectRatio) + 'vh, ' + (480 * videoAspectRatio) + 'px)' }}><video ref={videoElement} src={videoPreview} controls className="block h-auto w-full" onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)} onSeeked={(event) => setTime(event.currentTarget.currentTime)} onError={() => setError('O navegador não reproduziu este formato. Para visualizar, converta o vídeo para MP4/H.264.')} />{result && <div className="pointer-events-none absolute inset-0" aria-hidden="true">{sample?.detections.map((detection, index) => <div key={index} className="absolute border-2 border-green-400" style={{ left: (detection.bbox.x * 100) + '%', top: (detection.bbox.y * 100) + '%', width: (detection.bbox.width * 100) + '%', height: (detection.bbox.height * 100) + '%' }}><span className="absolute left-0 top-0 bg-green-400 px-1 text-xs text-black">Cachorro {(detection.confidence * 100).toFixed(0)}%</span></div>)}</div>}</div></div>{result && <p aria-live="polite" className="mt-4 text-xs text-muted-foreground"><Clock3 className="mr-1 inline-block h-3.5 w-3.5" />{clock(time)} · {sample?.detections.length ?? 0} cachorro(s) detectado(s) na amostra.</p>}</section>;
}

function VideoResultDetails({ result, videoElement, download }: { result: VideoResult; videoElement: RefObject<HTMLVideoElement | null>; download: (kind: 'json' | 'csv') => void }) {
  const metrics: Array<[string, string, ComponentType<{ className?: string }>]> = [['Quadros analisados', String(result.analyzed_frames), Activity], ['Máximo simultâneo', String(result.max_dogs), PawPrint], ['Presença estimada', result.presence_seconds.toFixed(1) + ' s', Clock3], ['Processamento', result.processing_seconds.toFixed(1) + ' s', Sparkles]];
  return <><section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, Icon]) => <div key={label} className="rounded-2xl border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)]"><div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-primary" /></div><p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-card-foreground">{value}</p></div>)}</section><section className="mt-6 rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6"><div className="flex flex-col gap-4 border-b border-border/80 pb-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Evidências da análise</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Intervalos com cachorro detectado</h2></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => download('json')} className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:border-primary/35 hover:text-primary"><Download className="h-3.5 w-3.5" />JSON</button><button type="button" onClick={() => download('csv')} className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:border-primary/35 hover:text-primary"><Download className="h-3.5 w-3.5" />CSV</button></div></div><p className="mt-5 text-xs leading-5 text-muted-foreground">Amostragem a cada {result.sample_interval_seconds.toFixed(2)} s. Os intervalos são estimativas de presença visual; trechos entre amostras podem conter ocorrências não detectadas.</p>{!result.intervals.length ? <p className="mt-5 rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">Nenhum cachorro foi detectado nas amostras analisadas.</p> : <div className="mt-5 flex flex-wrap gap-2">{result.intervals.map((interval, index) => <button type="button" key={index} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-accent" onClick={() => { if (videoElement.current) videoElement.current.currentTime = interval.start_seconds; }}>{clock(interval.start_seconds)} — {clock(interval.end_seconds)}</button>)}</div>}<p className="mt-5 text-[11px] leading-5 text-muted-foreground">O relatório inclui caixas, escores, parâmetros e tempos. Exporte antes de sair desta tela.</p></section></>;
}

function ResultHeader({ icon, tone, eyebrow, title, detail }: { icon: React.ReactNode; tone: 'success' | 'warning'; eyebrow: string; title: string; detail: string }) {
  const color = tone === 'success' ? 'bg-success/12 text-success' : 'bg-warning/15 text-warning';
  return <div className="flex items-start gap-3"><span className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ' + color}>{icon}</span><div><p className={'text-[10px] font-semibold uppercase tracking-[0.16em] ' + (tone === 'success' ? 'text-success' : 'text-warning')}>{eyebrow}</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.035em] text-card-foreground">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p></div></div>;
}
