import Link from "next/link";
import { ChevronRight, Dog, PawPrint, Plus, UsersRound } from "lucide-react";


export default function AnimalsPage() {
  return (
    <div className="min-h-screen bg-[#f5f5f3] text-zinc-900">
      <div className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <header className="mb-8 border-b border-zinc-200 pb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Cadastro</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Animais</h1>
            <p className="mt-2 text-sm text-zinc-500">Escolha o que deseja fazer com os perfis dos animais.</p>
          </header>
          <section className="grid gap-5 md:grid-cols-2">
            <Link href="/dashboard/animals/new" className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-md">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-950 text-white"><Plus className="h-5 w-5" /></span>
              <div className="mt-8 flex items-end justify-between gap-4"><div><h2 className="text-xl font-semibold tracking-tight">Cadastrar novo animal</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Adicione nome, espécie e uma foto de perfil para preparar o acompanhamento.</p></div><ChevronRight className="mb-1 h-5 w-5 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-1" /></div>
            </Link>
            <Link href="/dashboard/animals/list" className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-md">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700"><UsersRound className="h-5 w-5" /></span>
              <div className="mt-8 flex items-end justify-between gap-4"><div><h2 className="text-xl font-semibold tracking-tight">Animais cadastrados</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Visualize os perfis existentes e abra um cadastro para editar os dados.</p></div><ChevronRight className="mb-1 h-5 w-5 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-1" /></div>
            </Link>
          </section>
          <div className="mt-8 flex items-center gap-3 rounded-xl border border-dashed border-zinc-300 px-5 py-4 text-sm text-zinc-500"><PawPrint className="h-4 w-4 text-zinc-400" />Os perfis cadastrados serão usados futuramente na identificação dos animais.</div>
        </div>
      </div>
    </div>
  );
}
