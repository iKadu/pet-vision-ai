import Link from "next/link";
import { Plus, UsersRound } from "lucide-react";

import { DashboardBackLink } from "../../dashboard-back-link";

export default function AnimalsListPage() {
  return (
    <div className="min-h-screen bg-[#f5f5f3] text-zinc-900">
      <div className="px-5 py-8 sm:px-8 sm:py-10 lg:px-10"><div className="mx-auto max-w-5xl">
        <DashboardBackLink href="/dashboard/animals" label="Animais" />
        <header className="mb-8 mt-5 border-b border-zinc-200 pb-7"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Perfis</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Animais cadastrados</h1><p className="mt-2 text-sm text-zinc-500">Consulte e edite os perfis acompanhados pelo sistema.</p></header>
        <section className="rounded-xl border border-dashed border-zinc-300 bg-white/60 px-6 py-16 sm:py-20"><div className="mx-auto flex max-w-md flex-col items-center text-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"><UsersRound className="h-5 w-5" /></span><h2 className="mt-5 text-lg font-semibold tracking-tight">Nenhum animal cadastrado</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Cadastre o primeiro perfil para começar a organizar a identificação dos animais.</p><Link href="/dashboard/animals/new" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"><Plus className="h-4 w-4" />Cadastrar primeiro animal</Link></div></section>
      </div></div>
    </div>
  );
}
