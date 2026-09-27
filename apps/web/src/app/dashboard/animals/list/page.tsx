"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, ImagePlus, Pencil, Plus, Trash2, UsersRound, X } from "lucide-react";

import { DashboardBackLink } from "../../dashboard-back-link";
import { trpc } from "@/utils/trpc";

const MAX_REFERENCE_PHOTOS = 5;

export default function AnimalsListPage() {
  const petsQuery = useQuery(trpc.pets.list.queryOptions());
  const referencesQuery = useQuery(
    trpc.pets.listEmbeddingReferences.queryOptions(),
  );
  const [editingPet, setEditingPet] = useState<{
    id: string;
    name: string;
    species: "dog" | "cat";
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
      formData.append("file", file);

      const uploadResponse = await fetch("/api/uploads/pets", {
        method: "POST",
        body: formData,
      });
      const uploadResult = (await uploadResponse.json()) as {
        url?: string;
        error?: string;
      };
      if (!uploadResponse.ok || !uploadResult.url) {
        throw new Error(uploadResult.error ?? "Não foi possível enviar a foto");
      }

      const embeddingResponse = await fetch("/api/pets/embeddings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ petId, photoUrl: uploadResult.url }),
      });
      const embeddingResult = (await embeddingResponse.json()) as {
        error?: string;
      };
      if (!embeddingResponse.ok) {
        throw new Error(
          embeddingResult.error ?? "Não foi possível preparar a foto de referência",
        );
      }
    },
    onSuccess: () => void referencesQuery.refetch(),
  });

  function startEditing(pet: {
    id: string;
    name: string;
    species: string;
    breed: string | null;
  }) {
    setEditingPet({
      id: pet.id,
      name: pet.name,
      species: pet.species as "dog" | "cat",
      breed: pet.breed ?? "",
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
    if (
      window.confirm(
        `Excluir o perfil de ${name}? Essa ação não pode ser desfeita.`,
      )
    ) {
      deletePet.mutate({ id });
    }
  }

  function addReference(event: React.ChangeEvent<HTMLInputElement>, petId: string) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || addReferencePhoto.isPending) return;
    addReferencePhoto.mutate({ petId, file });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <DashboardBackLink href="/dashboard/animals" label="Animais" />
          <header className="mb-8 mt-5 border-b border-border pb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Perfis
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Animais cadastrados
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Consulte e edite os perfis acompanhados pelo sistema.
            </p>
          </header>
          {petsQuery.isPending && (
            <section className="rounded-xl border border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
              Carregando animais...
            </section>
          )}
          {petsQuery.isError && (
            <section className="rounded-xl border border-destructive/25 bg-destructive/10 px-6 py-12 text-center">
              <h2 className="text-sm font-semibold text-destructive">
                Não foi possível carregar os animais
              </h2>
              <p className="mt-2 text-sm text-destructive">
                Verifique sua conexão e tente novamente.
              </p>
              <button
                type="button"
                onClick={() => void petsQuery.refetch()}
                className="mt-5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                Tentar novamente
              </button>
            </section>
          )}
          {petsQuery.isSuccess && petsQuery.data.length === 0 && (
            <section className="rounded-xl border border-dashed border-border bg-card/60 px-6 py-16 sm:py-20">
              <div className="mx-auto flex max-w-md flex-col items-center text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised text-muted-foreground">
                  <UsersRound className="h-5 w-5" />
                </span>
                <h2 className="mt-5 text-lg font-semibold tracking-tight">
                  Nenhum animal cadastrado
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Cadastre o primeiro perfil para começar a organizar a
                  identificação dos animais.
                </p>
                <Link
                  href="/dashboard/animals/new"
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  <Plus className="h-4 w-4" />
                  Cadastrar primeiro animal
                </Link>
              </div>
            </section>
          )}
          {petsQuery.isSuccess && petsQuery.data.length > 0 && (
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {petsQuery.data.map((pet) => (
                <article
                  key={pet.id}
                  className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                >
                  <div className="flex aspect-[4/3] items-center justify-center bg-surface-raised text-muted-foreground">
                    {pet.photoUrl ? (
                      <img
                        src={pet.photoUrl}
                        alt={`Foto de ${pet.name}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UsersRound className="h-8 w-8" />
                    )}
                  </div>
                  {editingPet?.id === pet.id ? (
                    <form onSubmit={savePetEdit} className="space-y-3 p-5">
                      <label className="block">
                        <span className="text-xs font-medium text-muted-foreground">
                          Nome
                        </span>
                        <input
                          value={editingPet.name}
                          onChange={(event) =>
                            setEditingPet((current) =>
                              current
                                ? { ...current, name: event.target.value }
                                : current,
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                          autoFocus
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="text-xs font-medium text-muted-foreground">
                            Espécie
                          </span>
                          <select
                            value={editingPet.species}
                            onChange={(event) =>
                              setEditingPet((current) =>
                                current
                                  ? {
                                      ...current,
                                      species: event.target.value as
                                        "dog" | "cat",
                                    }
                                  : current,
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-2 text-sm outline-none focus:border-primary"
                          >
                            <option value="dog">Cachorro</option>
                            <option value="cat">Gato</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-xs font-medium text-muted-foreground">
                            Raça
                          </span>
                          <input
                            value={editingPet.breed}
                            onChange={(event) =>
                              setEditingPet((current) =>
                                current
                                  ? { ...current, breed: event.target.value }
                                  : current,
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-border px-2 py-2 text-sm outline-none focus:border-primary"
                          />
                        </label>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingPet(null)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={
                            updatePet.isPending || !editingPet.name.trim()
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" />
                          {updatePet.isPending ? "Salvando" : "Salvar"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="p-5">
                      <h2 className="font-semibold tracking-tight">
                        {pet.name}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {pet.species === "dog" ? "Cachorro" : "Gato"}
                        {pet.breed ? ` · ${pet.breed}` : ""}
                      </p>
                      {(() => {
                        const references =
                          referencesQuery.data?.filter(
                            (reference) => reference.petId === pet.id,
                          ) ?? [];
                        const canAddReference =
                          referencesQuery.isSuccess &&
                          references.length < MAX_REFERENCE_PHOTOS;
                        const isAddingReference =
                          addReferencePhoto.isPending &&
                          addReferencePhoto.variables?.petId === pet.id;

                        return (
                          <div className="mt-4 border-t border-border pt-4">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-medium text-foreground">
                                Fotos de referência
                              </span>
                              <span className="text-xs tabular-nums text-muted-foreground">
                                {references.length}/{MAX_REFERENCE_PHOTOS}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {references.length === 0
                                ? "Adicione fotos em outros ângulos para iniciar a identificação."
                                : references.length < MAX_REFERENCE_PHOTOS
                                  ? "Outros ângulos tornam o reconhecimento mais confiável."
                                  : "Limite de referências atingido."}
                            </p>
                            <div className="mt-3 grid grid-cols-5 gap-2">
                              {references.map((reference) =>
                                reference.sourcePhotoUrl ? (
                                  <img
                                    key={reference.id}
                                    src={reference.sourcePhotoUrl}
                                    alt={`Referência de ${pet.name}`}
                                    className="aspect-square w-full rounded-md object-cover"
                                  />
                                ) : (
                                  <span
                                    key={reference.id}
                                    className="flex aspect-square items-center justify-center rounded-md bg-surface-raised text-muted-foreground"
                                    aria-label="Referência sem imagem"
                                  >
                                    <UsersRound className="h-4 w-4" />
                                  </span>
                                ),
                              )}
                              {canAddReference && (
                                <label className="flex aspect-square cursor-pointer items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
                                  <ImagePlus className="h-4 w-4" />
                                  <span className="sr-only">
                                    Adicionar foto de referência para {pet.name}
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="sr-only"
                                    onChange={(event) => addReference(event, pet.id)}
                                  />
                                </label>
                              )}
                            </div>
                            {isAddingReference && (
                              <p className="mt-3 text-xs text-muted-foreground">
                                Preparando referência biométrica...
                              </p>
                            )}
                            {addReferencePhoto.isError &&
                              addReferencePhoto.variables?.petId === pet.id && (
                                <p className="mt-3 text-xs text-destructive">
                                  {addReferencePhoto.error instanceof Error
                                    ? addReferencePhoto.error.message
                                    : "Não foi possível adicionar a foto de referência."}
                                </p>
                              )}
                          </div>
                        );
                      })()}
                      <div className="mt-4 flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => startEditing(pet)}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => removePet(pet.id, pet.name)}
                          disabled={deletePet.isPending}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
