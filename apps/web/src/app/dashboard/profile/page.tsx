"use client";

import { Check, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ProfilePage() {
  const { data: session, isPending } = authClient.useSession();
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (session?.user.name) setName(session.user.name);
  }, [session?.user.name]);

  const trimmedName = name.trim();
  const initials = useMemo(
    () => getInitials(trimmedName || session?.user.name || "PV"),
    [session?.user.name, trimmedName],
  );
  const hasChanges = Boolean(
    session && trimmedName && trimmedName !== session.user.name,
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasChanges || isSaving) return;

    setIsSaving(true);
    try {
      const result = await authClient.updateUser({ name: trimmedName });
      if (result.error) {
        throw new Error(result.error.message || "Não foi possível atualizar o perfil.");
      }
      toast.success("Perfil atualizado.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o perfil.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isPending) {
    return (
      <div className="min-h-screen px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl animate-pulse">
          <div className="h-9 w-40 rounded-md bg-zinc-200" />
          <div className="mt-3 h-5 w-80 max-w-full rounded-md bg-zinc-200" />
          <div className="mt-10 h-80 rounded-xl bg-white" />
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen text-zinc-900">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <header className="border-b border-zinc-200 pb-7">
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-zinc-950">
            Meu perfil
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            Atualize como seu nome aparece no PetVision e consulte os dados da sua conta.
          </p>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-4 border-b border-zinc-100 pb-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">
                {initials}
              </span>
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-zinc-950">{session.user.name}</h2>
                <p className="mt-1 truncate text-sm text-zinc-500">{session.user.email}</p>
              </div>
            </div>

            <div className="mt-6">
              <label htmlFor="profile-name" className="block text-sm font-medium text-zinc-800">
                Nome de exibição
              </label>
              <input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                autoComplete="name"
                className="mt-2 h-10 w-full max-w-md rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Este nome é exibido na navegação e na sua conta.
              </p>
            </div>

            <div className="mt-6 border-t border-zinc-100 pt-6">
              <p className="text-sm font-medium text-zinc-800">
                E-mail de acesso
              </p>
              <div className="mt-2 flex h-10 max-w-md items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-500">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate">{session.user.email}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                O e-mail permanece protegido nesta versão do sistema.
              </p>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-5">
              <button
                type="submit"
                disabled={!hasChanges || isSaving}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check className="h-4 w-4" />
                {isSaving ? "Salvando..." : "Salvar perfil"}
              </button>
              <p aria-live="polite" className="text-xs text-zinc-500">
                O novo nome será atualizado na sua sessão atual.
              </p>
            </div>
          </form>

          <aside className="self-start rounded-xl border border-zinc-200 bg-zinc-50 p-5">
            <div className="flex items-center gap-2 text-zinc-700">
              <ShieldCheck className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Conta protegida</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              Seus pets, câmeras e eventos continuam vinculados exclusivamente à sua conta.
            </p>
            <div className="mt-5 border-t border-zinc-200 pt-4">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                <UserRound className="h-4 w-4" />
                Dados pessoais mínimos
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Apenas o nome de exibição pode ser alterado por aqui. Isso evita mudanças acidentais no acesso.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
