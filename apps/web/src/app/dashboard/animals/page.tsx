import Link from "next/link";
import { ChevronRight, Dog, PawPrint, Plus, UsersRound } from "lucide-react";


export default function AnimalsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <header className="mb-8 border-b border-border pb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cadastro</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Animais</h1>
            <p className="mt-2 text-sm text-muted-foreground">Escolha o que deseja fazer com os perfis dos animais.</p>
          </header>
          <section className="grid gap-5 md:grid-cols-2">
            <Link href="/dashboard/animals/new" className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Plus className="h-5 w-5" /></span>
              <div className="mt-8 flex items-end justify-between gap-4"><div><h2 className="text-xl font-semibold tracking-tight">Cadastrar novo animal</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Adicione nome, espécie e uma foto de perfil para preparar o acompanhamento.</p></div><ChevronRight className="mb-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" /></div>
            </Link>
            <Link href="/dashboard/animals/list" className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-raised text-foreground"><UsersRound className="h-5 w-5" /></span>
              <div className="mt-8 flex items-end justify-between gap-4"><div><h2 className="text-xl font-semibold tracking-tight">Animais cadastrados</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Visualize os perfis existentes e abra um cadastro para editar os dados.</p></div><ChevronRight className="mb-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" /></div>
            </Link>
          </section>
          <div className="mt-8 flex items-center gap-3 rounded-xl border border-dashed border-border px-5 py-4 text-sm text-muted-foreground"><PawPrint className="h-4 w-4 text-muted-foreground" />Os perfis cadastrados serão usados futuramente na identificação dos animais.</div>
        </div>
      </div>
    </div>
  );
}
