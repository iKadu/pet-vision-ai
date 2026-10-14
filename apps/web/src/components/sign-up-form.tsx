import { Button } from "@tccpet/ui/components/button";
import { Input } from "@tccpet/ui/components/input";
import { Label } from "@tccpet/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { ArrowRight, BellRing, Camera, LockKeyhole, Mail, PawPrint, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

export default function SignUpForm({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const router = useRouter();
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: { email: "", password: "", name: "" },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        { email: value.email, password: value.password, name: value.name },
        {
          onSuccess: () => {
            router.push("/dashboard");
            toast.success("Conta criada com sucesso.");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "Informe um nome com ao menos 2 caracteres."),
        email: z.email("Informe um e-mail válido."),
        password: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
      }),
    },
  });

  if (isPending) return <Loader />;

  return (
    <main className="relative flex min-h-svh items-center overflow-hidden bg-background px-4 py-5 sm:p-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,oklch(from_var(--primary)_l_c_h_/_0.16),transparent_66%)]" />
      <div className="relative mx-auto grid w-full max-w-[1120px] overflow-hidden rounded-[32px] border border-border/80 bg-card/90 shadow-[0_28px_80px_oklch(0_0_0_/_0.13)] backdrop-blur-xl lg:min-h-[680px] lg:grid-cols-[0.92fr_1.08fr]">
        <section className="relative hidden overflow-hidden bg-[linear-gradient(145deg,oklch(0.19_0.04_188),oklch(0.12_0.025_208))] p-10 text-white lg:flex lg:flex-col">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="relative flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_28px_oklch(0.75_0.14_185_/_0.25)]"><PawPrint className="h-5 w-5" /></span><span className="text-lg font-semibold tracking-[-0.035em]">PetVision</span></div>
          <div className="relative my-auto pt-14"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Comece por aqui</p><h1 className="mt-4 max-w-sm text-4xl font-semibold leading-[1.05] tracking-[-0.06em]">Uma visão mais atenta para a rotina do seu pet.</h1><p className="mt-5 max-w-sm text-sm leading-6 text-white/65">Crie seu acesso para cadastrar referências, configurar câmeras e acompanhar a presença dos seus animais.</p></div>
          <div className="relative space-y-3"><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/7 p-3.5 backdrop-blur-sm"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 text-primary"><Camera className="h-4 w-4" /></span><div><p className="text-xs font-semibold">Câmera conectada</p><p className="mt-0.5 text-[11px] text-white/55">Acompanhe a fonte escolhida em tempo real.</p></div></div><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/7 p-3.5 backdrop-blur-sm"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 text-primary"><BellRing className="h-4 w-4" /></span><div><p className="text-xs font-semibold">Alertas no momento certo</p><p className="mt-0.5 text-[11px] text-white/55">Receba avisos após uma ausência confirmada.</p></div></div></div>
        </section>

        <section className="flex items-center px-5 py-8 sm:px-10 lg:px-14">
          <div className="mx-auto w-full max-w-md">
            <div className="flex items-center gap-3 lg:hidden"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><PawPrint className="h-5 w-5" /></span><span className="text-lg font-semibold tracking-[-0.035em] text-foreground">PetVision</span></div>
            <p className="mt-10 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary lg:mt-0">Seu espaço de cuidado</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-foreground sm:text-4xl">Crie sua conta.</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Leva apenas um instante para começar a organizar o monitoramento dos seus pets.</p>

            <form onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); form.handleSubmit(); }} className="mt-8 space-y-4">
              <form.Field name="name">{(field) => <div className="space-y-2"><Label htmlFor={field.name} className="font-semibold text-foreground">Nome</Label><div className="relative"><UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id={field.name} name={field.name} placeholder="Como podemos chamar você?" autoComplete="name" value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} className="pl-10" /></div>{field.state.meta.errors.map((error) => <p key={error?.message} className="text-xs font-medium text-destructive">{error?.message}</p>)}</div>}</form.Field>
              <form.Field name="email">{(field) => <div className="space-y-2"><Label htmlFor={field.name} className="font-semibold text-foreground">E-mail</Label><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id={field.name} name={field.name} type="email" placeholder="voce@exemplo.com" autoComplete="email" value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} className="pl-10" /></div>{field.state.meta.errors.map((error) => <p key={error?.message} className="text-xs font-medium text-destructive">{error?.message}</p>)}</div>}</form.Field>
              <form.Field name="password">{(field) => <div className="space-y-2"><Label htmlFor={field.name} className="font-semibold text-foreground">Senha</Label><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id={field.name} name={field.name} type="password" placeholder="Ao menos 8 caracteres" autoComplete="new-password" value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} className="pl-10" /></div>{field.state.meta.errors.map((error) => <p key={error?.message} className="text-xs font-medium text-destructive">{error?.message}</p>)}</div>}</form.Field>
              <form.Subscribe selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}>{({ canSubmit, isSubmitting }) => <Button type="submit" size="lg" className="mt-2 h-11 w-full text-sm font-semibold shadow-[0_10px_22px_color-mix(in_oklch,var(--primary)_24%,transparent)]" disabled={!canSubmit || isSubmitting}>{isSubmitting ? "Criando conta..." : <>Criar conta <ArrowRight className="h-4 w-4" /></>}</Button>}</form.Subscribe>
            </form>

            <p className="mt-7 text-center text-sm text-muted-foreground">Já tem uma conta? <button type="button" onClick={onSwitchToSignIn} className="font-semibold text-primary transition hover:text-primary-hover">Entrar</button></p>
          </div>
        </section>
      </div>
    </main>
  );
}
