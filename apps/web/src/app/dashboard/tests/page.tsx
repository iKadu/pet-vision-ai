'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, FileImage, ImageUp, LoaderCircle, PawPrint, ScanSearch, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { trpc } from '@/utils/trpc';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAXIMUM_FILE_SIZE = 5 * 1024 * 1024;

type MatchCandidate = {
  petId: string;
  petName: string;
  similarity: number;
};

type MatchResult = {
  threshold: number;
  marginThreshold: number;
  margin: number | null;
  candidate: MatchCandidate | null;
  runnerUp: MatchCandidate | null;
  match: MatchCandidate | null;
  possibleMatch: MatchCandidate | null;
};

function formatPercentage(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(value);
}

export default function IdentificationTestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const petsQuery = useQuery(trpc.pets.list.queryOptions());
  const referencesQuery = useQuery(trpc.pets.listEmbeddingReferences.queryOptions());

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const referencePetIds = useMemo(
    () => new Set(referencesQuery.data?.map((reference) => reference.petId) ?? []),
    [referencesQuery.data],
  );
  const readyPets = petsQuery.data?.filter((pet) => referencePetIds.has(pet.id)) ?? [];

  function selectFile(selectedFile: File | null) {
    setResult(null);
    setError(null);
    if (!selectedFile) {
      setFile(null);
      return;
    }
    if (!ACCEPTED_TYPES.includes(selectedFile.type) || selectedFile.size === 0 || selectedFile.size > MAXIMUM_FILE_SIZE) {
      setFile(null);
      setError('Use uma foto JPG, PNG ou WEBP de até 5 MB.');
      return;
    }
    setFile(selectedFile);
  }

  async function identifyPet() {
    if (!file || isAnalyzing) return;
    setError(null);
    setResult(null);
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/pets/matches', {
        method: 'POST',
        headers: { 'content-type': file.type },
        body: file,
      });
      const body = await response.json() as MatchResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Não foi possível identificar o animal pela foto.');
      setResult(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível identificar o animal pela foto.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  const identifiedPet = result?.match;
  const possiblePet = result?.possibleMatch;
  const candidate = identifiedPet ?? possiblePet ?? result?.candidate;
  const hasProfiles = Boolean(petsQuery.data?.length);

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-[1180px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
        <header className="border-b border-border/80 pb-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Validação visual</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-foreground sm:text-4xl">Teste de identificação</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Envie uma foto de um cachorro para comparar com as referências visuais dos animais cadastrados. A foto de teste não é salva no cadastro.</p>
        </header>

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6">
            <div className="flex items-start gap-3 border-b border-border/80 pb-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><ImageUp className="h-5 w-5" /></span>
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Foto de teste</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Comparar com os perfis cadastrados</h2></div>
            </div>

            <label htmlFor="identification-test-photo" className="group mt-6 flex min-h-72 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-surface-raised/60 p-5 text-center transition hover:border-primary/55 hover:bg-accent/45">
              {previewUrl ? <img src={previewUrl} alt="Prévia da foto enviada para teste" className="max-h-[420px] w-full rounded-xl object-contain" /> : <><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-primary shadow-sm transition-transform group-hover:scale-105"><FileImage className="h-5 w-5" /></span><p className="mt-4 text-sm font-semibold text-card-foreground">Escolher uma foto</p><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">Use uma imagem nítida, bem iluminada, em que o cachorro esteja visível.</p></>}
              <input id="identification-test-photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={isAnalyzing} className="sr-only" onChange={(event) => { selectFile(event.target.files?.[0] ?? null); event.target.value = ''; }} />
            </label>

            {file && <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/55 px-3 py-2.5"><p className="min-w-0 truncate text-xs text-muted-foreground">{file.name} · {(file.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB</p><button type="button" onClick={() => selectFile(null)} disabled={isAnalyzing} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-surface-raised hover:text-foreground disabled:opacity-50" aria-label="Remover foto"><X className="h-4 w-4" /></button></div>}
            {error && <p role="alert" className="mt-5 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-3 py-3 text-xs leading-5 text-destructive">{error}</p>}

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border/80 pt-5">
              <button type="button" onClick={() => void identifyPet()} disabled={!file || isAnalyzing || !readyPets.length} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_8px_18px_color-mix(in_oklch,var(--primary)_18%,transparent)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"><ScanSearch className="h-4 w-4" />{isAnalyzing ? <><LoaderCircle className="h-4 w-4 animate-spin" />Analisando foto...</> : 'Identificar cachorro'}</button>
              <p className="text-xs leading-5 text-muted-foreground">JPG, PNG ou WEBP de até 5 MB.</p>
            </div>
          </section>

          <aside className="self-start rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6">
            <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><PawPrint className="h-5 w-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Base de comparação</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Perfis disponíveis</h2></div></div>
            {petsQuery.isPending || referencesQuery.isPending ? <div className="mt-5 space-y-3">{[0, 1].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-surface-raised" />)}</div> : !hasProfiles ? <div className="mt-5 rounded-2xl border border-dashed border-border bg-background/55 px-4 py-6 text-center"><CircleAlert className="mx-auto h-5 w-5 text-primary" /><p className="mt-3 text-sm font-semibold text-card-foreground">Nenhum animal cadastrado</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Cadastre um cachorro e inclua fotos de referência antes de testar.</p><Link href="/dashboard/animals/new" className="mt-4 inline-flex text-xs font-semibold text-primary hover:text-primary-hover">Cadastrar animal</Link></div> : <><p className="mt-5 text-xs leading-5 text-muted-foreground">Somente perfis com pelo menos uma foto de referência podem ser identificados.</p><div className="mt-4 space-y-2">{petsQuery.data?.map((pet) => {
              const ready = referencePetIds.has(pet.id);
              return <div key={pet.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/45 px-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-card-foreground">{pet.name}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{ready ? 'Pronto para comparação' : 'Sem foto de referência'}</p></div><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ready ? 'bg-success' : 'bg-muted-foreground/35'}`} title={ready ? 'Pronto para comparação' : 'Sem foto de referência'} /></div>;
            })}</div>{!readyPets.length && <p className="mt-4 rounded-xl border border-warning/25 bg-warning/[0.07] px-3 py-3 text-xs leading-5 text-foreground">Adicione ao menos uma foto de referência a um perfil para habilitar a identificação.</p>}</>}
          </aside>
        </div>

        {result && <section aria-live="polite" className="mt-6 rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6">
          {identifiedPet ? <ResultHeader icon={<CheckCircle2 className="h-5 w-5" />} tone="success" eyebrow="Identificação confirmada" title={`Este cachorro corresponde a ${identifiedPet.petName}`} detail={`Similaridade visual de ${formatPercentage(identifiedPet.similarity)}, acima do limiar de ${formatPercentage(result.threshold)}.`} /> : possiblePet ? <ResultHeader icon={<CircleAlert className="h-5 w-5" />} tone="warning" eyebrow="Possível correspondência" title={`A foto se parece com ${possiblePet.petName}`} detail={`A similaridade de ${formatPercentage(possiblePet.similarity)} atingiu o limiar, mas a diferença para outro perfil é pequena. Tente uma foto mais nítida ou adicione referências em outros ângulos.`} /> : candidate ? <ResultHeader icon={<CircleAlert className="h-5 w-5" />} tone="warning" eyebrow="Não identificado" title="Nenhum perfil atingiu o nível de confiança" detail={`O perfil mais próximo foi ${candidate.petName}, com similaridade de ${formatPercentage(candidate.similarity)}. O mínimo configurado é ${formatPercentage(result.threshold)}.`} /> : <ResultHeader icon={<CircleAlert className="h-5 w-5" />} tone="warning" eyebrow="Sem correspondências" title="Não há referências compatíveis para comparar" detail="Verifique se os animais cadastrados possuem fotos de referência processadas." />}
          {result.runnerUp && <p className="mt-5 border-t border-border/80 pt-4 text-xs leading-5 text-muted-foreground">Segundo perfil mais próximo: {result.runnerUp.petName} ({formatPercentage(result.runnerUp.similarity)}). Margem entre os perfis: {result.margin === null ? 'não se aplica' : formatPercentage(result.margin)}; mínimo: {formatPercentage(result.marginThreshold)}.</p>}
        </section>}
      </div>
    </div>
  );
}

function ResultHeader({ icon, tone, eyebrow, title, detail }: { icon: React.ReactNode; tone: 'success' | 'warning'; eyebrow: string; title: string; detail: string }) {
  const color = tone === 'success' ? 'bg-success/12 text-success' : 'bg-warning/15 text-warning';
  return <div className="flex items-start gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${color}`}>{icon}</span><div><p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${tone === 'success' ? 'text-success' : 'text-warning'}`}>{eyebrow}</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.035em] text-card-foreground">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p></div></div>;
}
