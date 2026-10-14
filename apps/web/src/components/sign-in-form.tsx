import { Button } from "@tccpet/ui/components/button";
import { Input } from "@tccpet/ui/components/input";
import { Label } from "@tccpet/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { ArrowRight, Eye, LockKeyhole, Mail, PawPrint, ScanEye } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

export default function SignInForm({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
  const router = useRouter();
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        { email: value.email, password: value.password },
        {
          onSuccess: () => {
            router.push("/dashboard");
            toast.success("Login realizado com sucesso.");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
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
          <div className="relative my-auto pt-14"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Monitoramento inteligente</p><h1 className="mt-4 max-w-sm text-4xl font-semibold leading-[1.05] tracking-[-0.06em]">Acompanhe quem importa, de um jeito mais tranquilo.</h1><p className="mt-5 max-w-sm text-sm leading-6 text-white/65">Câmeras, reconhecimento visual e alertas reunidos em uma experiência feita para cuidar dos seus pets.</p></div>
          <div className="relative grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/10 bg-white/7 p-4 backdrop-blur-sm"><ScanEye className="h-4 w-4 text-primary" /><p className="mt-5 text-xs font-semibold">Visão em tempo real</p><p className="mt-1 text-[11px] leading-4 text-white/55">Presença acompanhada pela fonte ativa.</p></div><div className="rounded-2xl border border-white/10 bg-white/7 p-4 backdrop-blur-sm"><Eye className="h-4 w-4 text-primary" /><p className="mt-5 text-xs font-semibold">Identificação visual</p><p className="mt-1 text-[11px] leading-4 text-white/55">Referências privadas para cada perfil.</p></div></div>
        </section>

        <section className="flex items-center px-5 py-8 sm:px-10 lg:px-14">
          <div className="mx-auto w-full max-w-md">
            <div className="flex items-center gap-3 lg:hidden"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><PawPrint className="h-5 w-5" /></span><span className="text-lg font-semibold tracking-[-0.035em] text-foreground">PetVision</span></div>
            <p className="mt-10 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary lg:mt-0">Acesse sua conta</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-foreground sm:text-4xl">Boas-vindas de volta.</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Entre para acompanhar as câmeras, os perfis e os alertas da sua casa.</p>

            <form onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); form.handleSubmit(); }} className="mt-8 space-y-5">
              <form.Field name="email">{(field) => <div className="space-y-2"><Label htmlFor={field.name} className="font-semibold text-foreground">E-mail</Label><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id={field.name} name={field.name} type="email" placeholder="voce@exemplo.com" autoComplete="email" value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} className="pl-10" /></div>{field.state.meta.errors.map((error) => <p key={error?.message} className="text-xs font-medium text-destructive">{error?.message}</p>)}</div>}</form.Field>
              <form.Field name="password">{(field) => <div className="space-y-2"><Label htmlFor={field.name} className="font-semibold text-foreground">Senha</Label><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id={field.name} name={field.name} type="password" placeholder="Sua senha" autoComplete="current-password" value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} className="pl-10" /></div>{field.state.meta.errors.map((error) => <p key={error?.message} className="text-xs font-medium text-destructive">{error?.message}</p>)}</div>}</form.Field>
              <form.Subscribe selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}>{({ canSubmit, isSubmitting }) => <Button type="submit" size="lg" className="mt-2 h-11 w-full text-sm font-semibold shadow-[0_10px_22px_color-mix(in_oklch,var(--primary)_24%,transparent)]" disabled={!canSubmit || isSubmitting}>{isSubmitting ? "Entrando..." : <>Entrar no PetVision <ArrowRight className="h-4 w-4" /></>}</Button>}</form.Subscribe>
            </form>

            <p className="mt-7 text-center text-sm text-muted-foreground">Ainda não tem conta? <button type="button" onClick={onSwitchToSignUp} className="font-semibold text-primary transition hover:text-primary-hover">Criar conta</button></p>
          </div>
        </section>
      </div>
    </main>
  );
}
