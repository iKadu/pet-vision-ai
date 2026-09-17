"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ImagePlus, PawPrint, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { DashboardBackLink } from "../../dashboard-back-link";
import { trpc } from "@/utils/trpc";

export default function NewAnimalPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<"dog" | "cat">("dog");
  const [photo, setPhoto] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const createPet = useMutation(
    trpc.pets.create.mutationOptions({
      onSuccess: () => router.push("/dashboard/animals/list"),
    }),
  );

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || createPet.isPending || isUploading) return;

    void savePet();
  }

  async function savePet() {
    setUploadError(null);
    let photoUrl: string | null = null;

    try {
      if (selectedFile) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", selectedFile);

        const response = await fetch("/api/uploads/pets", {
          method: "POST",
          body: formData,
        });
        const result = (await response.json()) as { url?: string; error?: string };

        if (!response.ok || !result.url) {
          throw new Error(result.error ?? "Não foi possível enviar a foto");
        }

        photoUrl = result.url;
      }

      await createPet.mutateAsync({
        name: name.trim(),
        species,
        photoUrl,
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Não foi possível salvar o animal");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f3] text-zinc-900">
      <div className="px-5 py-8 sm:px-8 sm:py-10 lg:px-10"><div className="mx-auto max-w-3xl">
        <DashboardBackLink href="/dashboard/animals" label="Animais" />
        <header className="mb-8 mt-5 border-b border-zinc-200 pb-7"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Novo cadastro</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Cadastrar animal</h1><p className="mt-2 text-sm text-zinc-500">Adicione as informações básicas do perfil.</p></header>
        <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-2"><PawPrint className="h-4 w-4 text-zinc-500" /><h2 className="font-semibold">Informações do animal</h2></div><label className="mt-6 block text-xs font-medium text-zinc-600" htmlFor="animal-name">Nome<input id="animal-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Thor" className="mt-2 h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-500" /></label><label className="mt-4 block text-xs font-medium text-zinc-600" htmlFor="animal-species">Espécie<select id="animal-species" value={species} onChange={(event) => setSpecies(event.target.value as "dog" | "cat")} className="mt-2 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-500"><option value="dog">Cachorro</option><option value="cat">Gato</option></select></label><label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-zinc-300 p-3 text-xs text-zinc-500 hover:border-zinc-500" htmlFor="animal-photo"><ImagePlus className="h-4 w-4" />{photo ? "Foto selecionada" : "Adicionar foto de perfil"}<input id="animal-photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setSelectedFile(file); setPhoto(URL.createObjectURL(file)); } }} /></label>{photo && <img src={photo} alt="Prévia do animal" className="mt-4 aspect-square max-w-xs rounded-lg object-cover" />}<p aria-live="polite" className="mt-4 text-sm text-rose-600">{uploadError ?? createPet.error?.message}</p><button type="submit" disabled={!name.trim() || createPet.isPending || isUploading} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" />{isUploading ? "Enviando foto..." : createPet.isPending ? "Salvando..." : "Salvar animal"}</button></form>
      </div></div>
    </div>
  );
}
