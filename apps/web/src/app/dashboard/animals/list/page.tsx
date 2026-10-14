'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  Check,
  Dog,
  ImagePlus,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';

import { DashboardBackLink } from '../../dashboard-back-link';
import { trpc } from '@/utils/trpc';

const MAX_REFERENCE_PHOTOS = 5;

export default function AnimalsListPage() {
  const petsQuery = useQuery(trpc.pets.list.queryOptions());
  const referencesQuery = useQuery(trpc.pets.listEmbeddingReferences.queryOptions());
  const [editingPet, setEditingPet] = useState<{
    id: string;
    name: string;
    species: 'dog' | 'cat';
    breed: string;
  } | null>(null);

  const updatePet = useMutation(
    trpc.pets.update.mutationOptions({
      onSuccess: () => {
        setEditingPet(null);
        void petsQuery.refetch();
      },
    }),
  );
  const deletePet = useMutation(
    trpc.pets.delete.mutationOptions({
      onSuccess: () => {
        setEditingPet(null);
        void petsQuery.refetch();
      },
    }),
  );
  const addReferencePhoto = useMutation({
    mutationFn: async ({ petId, file }: { petId: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/uploads/pets', { method: 'POST', body: formData });
      const uploadResult = (await uploadResponse.json()) as { url?: string; error?: string };
      if (!uploadResponse.ok || !uploadResult.url) {
        throw new Error(uploadResult.error ?? 'Não foi possível enviar a foto');
      }

      const embeddingResponse = await fetch('/api/pets/embeddings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ petId, photoUrl: uploadResult.url }),
      });
      const embeddingResult = (await embeddingResponse.json()) as { error?: string };
      if (!embeddingResponse.ok) {
        throw new Error(embeddingResult.error ?? 'Não foi possível preparar a foto de referência');
      }
    },
    onSuccess: () => void referencesQuery.refetch(),
  });

  function startEditing(pet: { id: string; name: string; species: string; breed: string | null }) {
    setEditingPet({
      id: pet.id,
      name: pet.name,
      species: pet.species as 'dog' | 'cat',
      breed: pet.breed ?? '',
    });
  }

  function savePetEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPet || !editingPet.name.trim()) return;
    updatePet.mutate({
      id: editingPet.id,
      data: {
        name: editingPet.name.trim(),
        species: editingPet.species,
        breed: editingPet.breed.trim() || null,
      },
    });
  }

  function removePet(id: string, name: string) {
    if (window.confirm(`Excluir o perfil de ${name}? Essa ação não pode ser desfeita.`)) {
      deletePet.mutate({ id });
    }
  }

  function addReference(event: React.ChangeEvent<HTMLInputElement>, petId: string) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || addReferencePhoto.isPending) return;
    addReferencePhoto.mutate({ petId, file });
  }

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
        <DashboardBackLink href="/dashboard/animals" label="Animais" />
        <header className="mt-5 flex flex-col gap-5 border-b border-border/80 pb-7 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Biblioteca de perfis</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-foreground sm:text-4xl">Animais cadastrados</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Organize perfis, amplie referências visuais e mantenha o reconhecimento preparado para o monitoramento.</p>
          </div>
          <Link href="/dashboard/animals/new" className="inline-flex h-10 w-fit items-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-[0_8px_18px_color-mix(in_oklch,var(--primary)_18%,transparent)] transition hover:bg-primary-hover">
            <Plus className="h-4 w-4" />
            Novo animal
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </header>

        {petsQuery.isPending && (
          <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((index) => <div key={index} className="h-[460px] animate-pulse rounded-[28px] border border-border/70 bg-card/60" />)}
          </section>
        )}

        {petsQuery.isError && (
          <section className="mt-7 rounded-[28px] border border-destructive/25 bg-destructive/[0.07] px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><X className="h-5 w-5" /></span>
            <h2 className="mt-4 text-lg font-semibold text-destructive">Não foi possível carregar os animais</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-destructive">Verifique sua conexão e tente novamente.</p>
            <button type="button" onClick={() => void petsQuery.refetch()} className="mt-5 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover">Tentar novamente</button>
          </section>
        )}

        {petsQuery.isSuccess && petsQuery.data.length === 0 && (
          <section className="mt-7 rounded-[28px] border border-dashed border-border bg-card/65 px-6 py-16 sm:py-20">
            <div className="mx-auto flex max-w-md flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><UsersRound className="h-6 w-6" /></span>
              <h2 className="mt-5 text-xl font-semibold tracking-[-0.035em] text-card-foreground">Comece pelo primeiro perfil</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Cadastre um animal e use uma foto nítida para criar a primeira referência do reconhecimento.</p>
              <Link href="/dashboard/animals/new" className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_8px_18px_color-mix(in_oklch,var(--primary)_18%,transparent)] transition hover:bg-primary-hover"><Plus className="h-4 w-4" />Cadastrar animal</Link>
            </div>
          </section>
        )}

        {petsQuery.isSuccess && petsQuery.data.length > 0 && (
          <section className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {petsQuery.data.map((pet) => {
              const references = referencesQuery.data?.filter((reference) => reference.petId === pet.id) ?? [];
              const canAddReference = referencesQuery.isSuccess && references.length < MAX_REFERENCE_PHOTOS;
              const isAddingReference = addReferencePhoto.isPending && addReferencePhoto.variables?.petId === pet.id;

              return (
                <article key={pet.id} className="group overflow-hidden rounded-[28px] border border-border/80 bg-card/85 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] transition duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_18px_40px_oklch(0_0_0_/_0.08)]">
                  <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface-raised text-muted-foreground">
                    {pet.photoUrl ? <img src={pet.photoUrl} alt={`Foto de ${pet.name}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /> : <Dog className="h-9 w-9" />}
                    <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-md"><span className="h-1.5 w-1.5 rounded-full bg-[#67e8d8]" />{references.length}/{MAX_REFERENCE_PHOTOS} referências</span>
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" />
                    <p className="absolute bottom-4 left-4 text-sm font-semibold text-white">{pet.species === 'dog' ? 'Cachorro' : 'Gato'}{pet.breed ? ` · ${pet.breed}` : ''}</p>
                  </div>

                  {editingPet?.id === pet.id ? (
                    <form onSubmit={savePetEdit} className="space-y-3 p-5">
                      <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-card-foreground">Editar perfil</p><button type="button" aria-label="Cancelar edição" onClick={() => setEditingPet(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-raised hover:text-foreground"><X className="h-4 w-4" /></button></div>
                      <label className="block"><span className="text-xs font-semibold text-muted-foreground">Nome</span><input value={editingPet.name} onChange={(event) => setEditingPet((current) => current ? { ...current, name: event.target.value } : current)} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" autoFocus /></label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block"><span className="text-xs font-semibold text-muted-foreground">Espécie</span><select value={editingPet.species} onChange={(event) => setEditingPet((current) => current ? { ...current, species: event.target.value as 'dog' | 'cat' } : current)} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-card px-2 text-sm text-foreground outline-none focus:border-primary"><option value="dog">Cachorro</option><option value="cat">Gato</option></select></label>
                        <label className="block"><span className="text-xs font-semibold text-muted-foreground">Raça</span><input value={editingPet.breed} onChange={(event) => setEditingPet((current) => current ? { ...current, breed: event.target.value } : current)} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-card px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2"><button type="button" onClick={() => setEditingPet(null)} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-muted-foreground transition hover:bg-surface-raised hover:text-foreground"><X className="h-3.5 w-3.5" />Cancelar</button><button type="submit" disabled={updatePet.isPending || !editingPet.name.trim()} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"><Check className="h-3.5 w-3.5" />{updatePet.isPending ? 'Salvando...' : 'Salvar'}</button></div>
                    </form>
                  ) : (
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><h2 className="truncate text-lg font-semibold tracking-[-0.03em] text-card-foreground">{pet.name}</h2><p className="mt-1 text-xs text-muted-foreground">Perfil pronto para receber referências visuais.</p></div>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Dog className="h-4 w-4" /></span>
                      </div>

                      <div className="mt-5 border-y border-border/80 py-4">
                        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-card-foreground">Fotos de referência</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{references.length === 0 ? 'Adicione imagens em outros ângulos.' : references.length < MAX_REFERENCE_PHOTOS ? 'Mais variedade melhora a identificação.' : 'Limite de referências atingido.'}</p></div><span className="rounded-full bg-surface-raised px-2 py-1 font-mono text-[10px] font-semibold text-muted-foreground">{references.length}/{MAX_REFERENCE_PHOTOS}</span></div>

                        <div className="mt-3 grid grid-cols-5 gap-2">
                          {references.map((reference) => reference.sourcePhotoUrl ? <img key={reference.id} src={reference.sourcePhotoUrl} alt={`Referência de ${pet.name}`} className="aspect-square w-full rounded-lg border border-border/70 object-cover" /> : <span key={reference.id} className="flex aspect-square items-center justify-center rounded-lg bg-surface-raised text-muted-foreground" aria-label="Referência sem imagem"><Dog className="h-3.5 w-3.5" /></span>)}
                          {canAddReference && (
                            <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground transition hover:border-primary hover:bg-accent hover:text-primary">
                              <ImagePlus className="h-4 w-4" />
                              <span className="sr-only">Adicionar foto de referência para {pet.name}</span>
                              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => addReference(event, pet.id)} />
                            </label>
                          )}
                        </div>
                        {isAddingReference && <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-primary" />Preparando referência biométrica...</p>}
                        {addReferencePhoto.isError && addReferencePhoto.variables?.petId === pet.id && <p className="mt-3 text-xs leading-5 text-destructive">{addReferencePhoto.error instanceof Error ? addReferencePhoto.error.message : 'Não foi possível adicionar a foto de referência.'}</p>}
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-[11px] text-muted-foreground">{references.length ? 'Referências salvas no perfil' : 'Sem referência adicional'}</span>
                        <div className="flex items-center gap-1"><button type="button" onClick={() => startEditing(pet)} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-surface-raised hover:text-foreground"><Pencil className="h-3.5 w-3.5" />Editar</button><button type="button" onClick={() => removePet(pet.id, pet.name)} disabled={deletePet.isPending} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Excluir ${pet.name}`}><Trash2 className="h-3.5 w-3.5" /></button></div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
