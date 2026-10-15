'use client';

import { Check, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { authClient } from '@/lib/auth-client';

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function ProfilePage() {
  const { data: session, isPending } = authClient.useSession();
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (session?.user.name) setName(session.user.name);
  }, [session?.user.name]);

  const trimmedName = name.trim();
  const initials = useMemo(() => getInitials(trimmedName || session?.user.name || 'PV'), [session?.user.name, trimmedName]);
  const hasChanges = Boolean(session && trimmedName && trimmedName !== session.user.name);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasChanges || isSaving) return;

    setIsSaving(true);
    try {
      const result = await authClient.updateUser({ name: trimmedName });
      if (result.error) throw new Error(result.error.message || 'Não foi possível atualizar o perfil.');
      toast.success('Perfil atualizado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o perfil.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isPending) {
    return <div className="min-h-screen px-5 py-8 sm:px-8 lg:px-10"><div className="mx-auto max-w-6xl animate-pulse"><div className="h-3 w-32 rounded-full bg-surface-raised" /><div className="mt-4 h-10 w-60 rounded-xl bg-surface-raised" /><div className="mt-8 h-96 rounded-[28px] border border-border bg-card" /></div></div>;
  }
  if (!session) return null;

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-[1180px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
        <header className="border-b border-border/80 pb-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Sua conta</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-foreground sm:text-4xl">Meu perfil</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Atualize como seu nome aparece no PetVision e consulte os dados vinculados à sua sessão.</p>
        </header>

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form onSubmit={handleSubmit} className="rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6">
            <div className="flex flex-col gap-5 border-b border-border/80 pb-6 sm:flex-row sm:items-center">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-primary text-lg font-semibold text-primary-foreground shadow-[0_10px_22px_color-mix(in_oklch,var(--primary)_20%,transparent)]">{initials}</span>
              <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Identidade do perfil</p><h2 className="mt-1 truncate text-xl font-semibold tracking-[-0.03em] text-card-foreground">{session.user.name}</h2><p className="mt-1 truncate text-sm text-muted-foreground">{session.user.email}</p></div>
            </div>

            <section className="mt-6">
              <label htmlFor="profile-name" className="block text-sm font-semibold text-foreground">Nome de exibição</label>
              <input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} autoComplete="name" className="mt-3 h-11 w-full max-w-md rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Este nome aparece na navegação e identifica sua sessão dentro do sistema.</p>
            </section>

            <section className="mt-6 border-t border-border/80 pt-5">
              <p className="text-sm font-semibold text-foreground">E-mail de acesso</p>
              <div className="mt-3 flex h-11 max-w-md items-center gap-2 rounded-xl border border-border bg-surface-raised/65 px-3 text-sm text-muted-foreground"><Mail className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{session.user.email}</span></div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">O e-mail é protegido nesta versão e não pode ser alterado por esta tela.</p>
            </section>

            <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-border/80 pt-5">
              <button type="submit" disabled={!hasChanges || isSaving} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_8px_18px_color-mix(in_oklch,var(--primary)_18%,transparent)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"><Check className="h-4 w-4" />{isSaving ? 'Salvando...' : 'Salvar perfil'}</button>
              <p aria-live="polite" className="text-xs leading-5 text-muted-foreground">O novo nome será atualizado na sua sessão atual.</p>
            </div>
          </form>

          <aside className="self-start rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-success/10 text-success"><ShieldCheck className="h-5 w-5" /></span>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-success">Conta protegida</p>
            <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Dados separados por usuário</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Seus animais, câmeras, referências e eventos ficam associados exclusivamente à sua conta.</p>
            <div className="mt-6 border-t border-border/80 pt-5"><div className="flex items-center gap-2 text-sm font-semibold text-card-foreground"><UserRound className="h-4 w-4 text-primary" />Dados pessoais mínimos</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Somente o nome de exibição pode ser alterado aqui, evitando mudanças acidentais no acesso.</p></div>
          </aside>
        </div>
      </div>
    </div>
  );
}
