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
  const [savedPet, setSavedPet] = useState<{ id: string; photoUrl: string } | null>(null);
  const createPet = useMutation(
    trpc.pets.create.mutationOptions(),
  );

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);

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
    const response = await fetch("/api/pets/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ petId, photoUrl }),
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(result.error ?? "Não foi possível gerar o embedding da foto");
    }
  }

  async function retryEmbedding() {
    if (!savedPet) return;

    setUploadError(null);
    setIsUploading(true);

    try {
      await generateEmbedding(savedPet.id, savedPet.photoUrl);
      router.push("/dashboard/animals/list");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Não foi possível gerar o embedding da foto");
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

      const pet = await createPet.mutateAsync({
        name: name.trim(),
        species,
        photoUrl,
      });

      if (photoUrl) {
        setSavedPet({ id: pet.id, photoUrl });
        await generateEmbedding(pet.id, photoUrl);
      }

      router.push("/dashboard/animals/list");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Não foi possível salvar o animal");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="px-5 py-8 sm:px-8 sm:py-10 lg:px-10"><div className="mx-auto max-w-3xl">
        <DashboardBackLink href="/dashboard/animals" label="Animais" />
        <header className="mb-8 mt-5 border-b border-border pb-7"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Novo cadastro</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Cadastrar animal</h1><p className="mt-2 text-sm text-muted-foreground">Adicione as informações básicas do perfil.</p></header>
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 shadow-sm"><div className="flex items-center gap-2"><PawPrint className="h-4 w-4 text-muted-foreground" /><h2 className="font-semibold">Informações do animal</h2></div><label className="mt-6 block text-xs font-medium text-muted-foreground" htmlFor="animal-name">Nome<input id="animal-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Thor" className="mt-2 h-10 w-full rounded-lg border border-border px-3 text-sm outline-none focus:border-primary" /></label><label className="mt-4 block text-xs font-medium text-muted-foreground" htmlFor="animal-species">Espécie<select id="animal-species" value={species} onChange={(event) => setSpecies(event.target.value as "dog" | "cat")} className="mt-2 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"><option value="dog">Cachorro</option><option value="cat">Gato</option></select></label><label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground hover:border-primary/50" htmlFor="animal-photo"><ImagePlus className="h-4 w-4" />{photo ? "Foto selecionada" : "Adicionar foto de perfil"}<input id="animal-photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(savedPet)} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setSelectedFile(file); setPhoto(URL.createObjectURL(file)); } }} /></label>{photo && <img src={photo} alt="Prévia do animal" className="mt-4 aspect-square max-w-xs rounded-lg object-cover" />}<p aria-live="polite" className="mt-4 text-sm text-destructive">{uploadError ?? createPet.error?.message}</p><button type="submit" disabled={(!name.trim() && !savedPet) || createPet.isPending || isUploading} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" />{isUploading ? "Processando foto..." : createPet.isPending ? "Salvando..." : savedPet ? "Tentar gerar identificação" : "Salvar animal"}</button></form>
      </div></div>
    </div>
  );
}
