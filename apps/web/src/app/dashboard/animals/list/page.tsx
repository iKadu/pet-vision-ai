"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, Pencil, Plus, Trash2, UsersRound, X } from "lucide-react";

import { DashboardBackLink } from "../../dashboard-back-link";
import { trpc } from "@/utils/trpc";

export default function AnimalsListPage() {
  const petsQuery = useQuery(trpc.pets.list.queryOptions());
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
    if (window.confirm(`Excluir o perfil de ${name}? Essa ação não pode ser desfeita.`)) {
      deletePet.mutate({ id });
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f3] text-zinc-900">
      <div className="px-5 py-8 sm:px-8 sm:py-10 lg:px-10"><div className="mx-auto max-w-5xl">
        <DashboardBackLink href="/dashboard/animals" label="Animais" />
        <header className="mb-8 mt-5 border-b border-zinc-200 pb-7"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Perfis</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Animais cadastrados</h1><p className="mt-2 text-sm text-zinc-500">Consulte e edite os perfis acompanhados pelo sistema.</p></header>
        {petsQuery.isPending && <section className="rounded-xl border border-zinc-200 bg-white px-6 py-16 text-center text-sm text-zinc-500">Carregando animais...</section>}
        {petsQuery.isError && <section className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-12 text-center"><h2 className="text-sm font-semibold text-rose-800">Não foi possível carregar os animais</h2><p className="mt-2 text-sm text-rose-700">Verifique sua conexão e tente novamente.</p><button type="button" onClick={() => void petsQuery.refetch()} className="mt-5 rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800">Tentar novamente</button></section>}
        {petsQuery.isSuccess && petsQuery.data.length === 0 && <section className="rounded-xl border border-dashed border-zinc-300 bg-white/60 px-6 py-16 sm:py-20"><div className="mx-auto flex max-w-md flex-col items-center text-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"><UsersRound className="h-5 w-5" /></span><h2 className="mt-5 text-lg font-semibold tracking-tight">Nenhum animal cadastrado</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Cadastre o primeiro perfil para começar a organizar a identificação dos animais.</p><Link href="/dashboard/animals/new" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"><Plus className="h-4 w-4" />Cadastrar primeiro animal</Link></div></section>}
        {petsQuery.isSuccess && petsQuery.data.length > 0 && <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{petsQuery.data.map((pet) => <article key={pet.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"><div className="flex aspect-[4/3] items-center justify-center bg-zinc-100 text-zinc-400">{pet.photoUrl ? <img src={pet.photoUrl} alt={`Foto de ${pet.name}`} className="h-full w-full object-cover" /> : <UsersRound className="h-8 w-8" />}</div>{editingPet?.id === pet.id ? <form onSubmit={savePetEdit} className="space-y-3 p-5"><label className="block"><span className="text-xs font-medium text-zinc-500">Nome</span><input value={editingPet.name} onChange={(event) => setEditingPet((current) => current ? { ...current, name: event.target.value } : current)} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition-colors focus:border-zinc-950" autoFocus /></label><div className="grid grid-cols-2 gap-2"><label className="block"><span className="text-xs font-medium text-zinc-500">Espécie</span><select value={editingPet.species} onChange={(event) => setEditingPet((current) => current ? { ...current, species: event.target.value as "dog" | "cat" } : current)} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm outline-none focus:border-zinc-950"><option value="dog">Cachorro</option><option value="cat">Gato</option></select></label><label className="block"><span className="text-xs font-medium text-zinc-500">Raça</span><input value={editingPet.breed} onChange={(event) => setEditingPet((current) => current ? { ...current, breed: event.target.value } : current)} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm outline-none focus:border-zinc-950" /></label></div><div className="flex items-center justify-end gap-2 pt-1"><button type="button" onClick={() => setEditingPet(null)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm text-zinc-500 transition-colors hover:text-zinc-900"><X className="h-4 w-4" />Cancelar</button><button type="submit" disabled={updatePet.isPending || !editingPet.name.trim()} className="inline-flex items-center gap-1 rounded-lg bg-zinc-950 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"><Check className="h-4 w-4" />{updatePet.isPending ? "Salvando" : "Salvar"}</button></div></form> : <div className="p-5"><h2 className="font-semibold tracking-tight">{pet.name}</h2><p className="mt-1 text-sm text-zinc-500">{pet.species === "dog" ? "Cachorro" : "Gato"}{pet.breed ? ` · ${pet.breed}` : ""}</p><div className="mt-4 flex items-center justify-end gap-3"><button type="button" onClick={() => startEditing(pet)} className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"><Pencil className="h-3.5 w-3.5" />Editar</button><button type="button" onClick={() => removePet(pet.id, pet.name)} disabled={deletePet.isPending} className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 transition-colors hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Excluir</button></div></div>}</article>)}</section>}
      </div></div>
    </div>
  );
}
