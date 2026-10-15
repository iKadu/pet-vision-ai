'use client';

import { useMutation } from '@tanstack/react-query';
import { ArrowUpRight, ImagePlus, PawPrint, Plus, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { DashboardBackLink } from '../../dashboard-back-link';
import { trpc } from '@/utils/trpc';

export default function NewAnimalPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog');
  const [photo, setPhoto] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savedPet, setSavedPet] = useState<{ id: string; photoUrl: string } | null>(null);
  const createPet = useMutation(trpc.pets.create.mutationOptions());

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo);
  }, [photo]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createPet.isPending || isUploading) return;

    if (savedPet) {
      void retryEmbedding();
      return;
    }

    if (!name.trim()) return;
    void savePet();
  }

  async function generateEmbedding(petId: string, photoUrl: string) {
    const response = await fetch('/api/pets/embeddings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ petId, photoUrl }),
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(result.error ?? 'Não foi possível gerar o embedding da foto');
    }
  }

  async function retryEmbedding() {
    if (!savedPet) return;

    setUploadError(null);
    setIsUploading(true);
    try {
      await generateEmbedding(savedPet.id, savedPet.photoUrl);
      router.push('/dashboard/animals/list');
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Não foi possível gerar o embedding da foto');
    } finally {
      setIsUploading(false);
    }
  }

  async function savePet() {
    setUploadError(null);
    let photoUrl: string | null = null;

    try {
      if (selectedFile) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', selectedFile);

        const response = await fetch('/api/uploads/pets', { method: 'POST', body: formData });
        const result = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !result.url) {
          throw new Error(result.error ?? 'Não foi possível enviar a foto');
        }
        photoUrl = result.url;
      }

      const pet = await createPet.mutateAsync({ name: name.trim(), species, photoUrl });
      if (photoUrl) {
        setSavedPet({ id: pet.id, photoUrl });
        await generateEmbedding(pet.id, photoUrl);
      }

      router.push('/dashboard/animals/list');
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Não foi possível salvar o animal');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-[1120px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
        <DashboardBackLink href="/dashboard/animals" label="Animais" />
        <header className="mt-5 border-b border-border/80 pb-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Novo perfil</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-foreground sm:text-4xl">Cadastrar animal</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Comece com uma foto bem iluminada. Depois, você poderá adicionar outros ângulos ao perfil.</p>
        </header>

        <form onSubmit={handleSubmit} className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6">
            <div className="flex items-start gap-3 border-b border-border/80 pb-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><PawPrint className="h-5 w-5" /></span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Informações básicas</p>
                <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Quem será monitorado?</h2>
              </div>
            </div>

            <label className="mt-6 block" htmlFor="animal-name">
              <span className="text-xs font-semibold text-foreground">Nome do animal</span>
              <input id="animal-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Thor" autoComplete="off" className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15" />
            </label>

            <fieldset className="mt-5">
              <legend className="text-xs font-semibold text-foreground">Espécie</legend>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {(['dog', 'cat'] as const).map((option) => {
                  const active = species === option;
                  const label = option === 'dog' ? 'Cachorro' : 'Gato';
                  return (
                    <button key={option} type="button" aria-pressed={active} onClick={() => setSpecies(option)} className={`flex h-12 items-center gap-3 rounded-xl border px-3 text-left transition ${active ? 'border-primary/45 bg-accent text-accent-foreground shadow-sm' : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-surface-raised hover:text-foreground'}`}>
                      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? 'bg-primary text-primary-foreground' : 'bg-surface-raised text-muted-foreground'}`}><PawPrint className="h-3.5 w-3.5" /></span>
                      <span className="text-sm font-semibold">{label}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {uploadError || createPet.error?.message ? (
              <p aria-live="polite" className="mt-5 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs leading-5 text-destructive">{uploadError ?? createPet.error?.message}</p>
            ) : null}

            <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-border/80 pt-5">
              <button type="submit" disabled={(!name.trim() && !savedPet) || createPet.isPending || isUploading} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_8px_18px_color-mix(in_oklch,var(--primary)_18%,transparent)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">
                <Plus className="h-4 w-4" />
                {isUploading ? 'Processando foto...' : createPet.isPending ? 'Salvando...' : savedPet ? 'Tentar gerar identificação' : 'Salvar animal'}
              </button>
              <p className="text-xs leading-5 text-muted-foreground">A foto de perfil gera a primeira referência visual do animal.</p>
            </div>
          </section>

          <aside className="self-start rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-raised text-primary"><ImagePlus className="h-5 w-5" /></span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Referência inicial</p>
                <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Foto de perfil</h2>
              </div>
            </div>

            <label htmlFor="animal-photo" className="group mt-5 flex aspect-[4/3] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-surface-raised/60 p-5 text-center transition hover:border-primary/55 hover:bg-accent/45 sm:aspect-square">
              {photo ? (
                <img src={photo} alt="Prévia do animal" className="h-full w-full object-cover" />
              ) : (
                <>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-primary shadow-sm transition-transform group-hover:scale-105"><ImagePlus className="h-5 w-5" /></span>
                  <p className="mt-4 text-sm font-semibold text-card-foreground">Adicionar uma foto</p>
                  <p className="mt-1 max-w-[210px] text-xs leading-5 text-muted-foreground">Use uma imagem nítida, com o pet visível e boa iluminação.</p>
                </>
              )}
              <input id="animal-photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(savedPet)} className="sr-only" onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setSelectedFile(file);
                setPhoto(URL.createObjectURL(file));
              }} />
            </label>
            {photo && !savedPet && <label htmlFor="animal-photo" className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover"><ImagePlus className="h-3.5 w-3.5" />Trocar foto</label>}

            <div className="mt-6 border-t border-border/80 pt-5">
              <div className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="text-xs leading-5 text-muted-foreground">Após salvar, adicione outras fotos na página de perfis para melhorar a identificação em ângulos, distâncias e iluminações diferentes.</p>
              </div>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}
