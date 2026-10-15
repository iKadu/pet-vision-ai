import Link from "next/link";
import { ArrowUpRight, Dog, ImagePlus, PawPrint, Plus, UsersRound } from "lucide-react";

export default function AnimalsPage() {
  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-[1280px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
        <header className="border-b border-border/80 pb-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Perfis e referências</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-foreground sm:text-4xl">Animais</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Crie perfis e reúna referências visuais para tornar o reconhecimento de cada pet mais confiável.</p>
        </header>

        <section className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Link href="/dashboard/animals/new" className="group relative overflow-hidden rounded-[28px] border border-primary/25 bg-primary p-6 text-primary-foreground shadow-[0_18px_40px_color-mix(in_oklch,var(--primary)_20%,transparent)] transition duration-300 hover:-translate-y-0.5 hover:bg-primary-hover sm:p-8">
            <span className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10"><Plus className="h-5 w-5" /></span>
            <div className="relative mt-12 flex items-end justify-between gap-5 sm:mt-16">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-foreground/65">Novo perfil</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Cadastrar animal</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-primary-foreground/75">Adicione uma foto inicial e as informações essenciais para começar a construir as referências do seu pet.</p>
              </div>
              <span className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1"><ArrowUpRight className="h-4 w-4" /></span>
            </div>
          </Link>

          <Link href="/dashboard/animals/list" className="group rounded-[28px] border border-border/80 bg-card/80 p-6 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_18px_40px_oklch(0_0_0_/_0.07)] sm:p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><UsersRound className="h-5 w-5" /></span>
            <div className="mt-12 flex items-end justify-between gap-5 sm:mt-16">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Biblioteca</p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.035em] text-card-foreground">Animais cadastrados</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Consulte os perfis, adicione novos ângulos e mantenha as referências organizadas.</p>
              </div>
              <ArrowUpRight className="mb-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-primary" />
            </div>
          </Link>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-border/80 bg-card/60 p-4"><Dog className="h-4 w-4 text-primary" /><p className="mt-4 text-sm font-semibold text-card-foreground">Perfil por animal</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Cada referência fica associada ao pet cadastrado.</p></article>
          <article className="rounded-2xl border border-border/80 bg-card/60 p-4"><ImagePlus className="h-4 w-4 text-info" /><p className="mt-4 text-sm font-semibold text-card-foreground">Vários ângulos</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Fotos variadas ajudam o motor a lidar com poses diferentes.</p></article>
          <article className="rounded-2xl border border-border/80 bg-card/60 p-4"><PawPrint className="h-4 w-4 text-success" /><p className="mt-4 text-sm font-semibold text-card-foreground">Reconhecimento criterioso</p><p className="mt-1 text-xs leading-5 text-muted-foreground">O sistema só confirma a identidade quando há evidência suficiente.</p></article>
        </section>
      </div>
    </div>
  );
}
