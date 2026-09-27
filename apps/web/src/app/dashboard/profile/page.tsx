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
          <div className="h-9 w-40 rounded-md bg-surface-raised" />
          <div className="mt-3 h-5 w-80 max-w-full rounded-md bg-surface-raised" />
          <div className="mt-10 h-80 rounded-xl bg-card" />
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <header className="border-b border-border pb-7">
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-foreground">
            Meu perfil
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Atualize como seu nome aparece no PetVision e consulte os dados da sua conta.
          </p>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex items-center gap-4 border-b border-border pb-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {initials}
              </span>
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-foreground">{session.user.name}</h2>
                <p className="mt-1 truncate text-sm text-muted-foreground">{session.user.email}</p>
              </div>
            </div>

            <div className="mt-6">
              <label htmlFor="profile-name" className="block text-sm font-medium text-foreground">
                Nome de exibição
              </label>
              <input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                autoComplete="name"
                className="mt-2 h-10 w-full max-w-md rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Este nome é exibido na navegação e na sua conta.
              </p>
            </div>

            <div className="mt-6 border-t border-border pt-6">
              <p className="text-sm font-medium text-foreground">
                E-mail de acesso
              </p>
              <div className="mt-2 flex h-10 max-w-md items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate">{session.user.email}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                O e-mail permanece protegido nesta versão do sistema.
              </p>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-border pt-5">
              <button
                type="submit"
                disabled={!hasChanges || isSaving}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check className="h-4 w-4" />
                {isSaving ? "Salvando..." : "Salvar perfil"}
              </button>
              <p aria-live="polite" className="text-xs text-muted-foreground">
                O novo nome será atualizado na sua sessão atual.
              </p>
            </div>
          </form>

          <aside className="self-start rounded-xl border border-border bg-surface-raised p-5">
            <div className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Conta protegida</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Seus pets, câmeras e eventos continuam vinculados exclusivamente à sua conta.
            </p>
            <div className="mt-5 border-t border-border pt-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <UserRound className="h-4 w-4" />
                Dados pessoais mínimos
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Apenas o nome de exibição pode ser alterado por aqui. Isso evita mudanças acidentais no acesso.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
