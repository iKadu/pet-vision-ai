'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Bell, Check, Clock3, MonitorCog, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { trpc } from '@/utils/trpc';

const DEFAULT_PREFERENCES = {
  absenceAlertSeconds: 30,
  notificationCooldownSeconds: 300,
  browserNotificationsEnabled: false,
};

export default function SettingsPage() {
  const preferencesQuery = useQuery(trpc.monitoringPreferences.get.queryOptions());
  const updatePreferences = useMutation(trpc.monitoringPreferences.update.mutationOptions());
  const [absenceAlertSeconds, setAbsenceAlertSeconds] = useState(DEFAULT_PREFERENCES.absenceAlertSeconds);
  const [notificationCooldownSeconds, setNotificationCooldownSeconds] = useState(DEFAULT_PREFERENCES.notificationCooldownSeconds);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(DEFAULT_PREFERENCES.browserNotificationsEnabled);
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');

  useEffect(() => {
    if (hasLoadedPreferences || !preferencesQuery.data) return;
    setAbsenceAlertSeconds(preferencesQuery.data.absenceAlertSeconds);
    setNotificationCooldownSeconds(preferencesQuery.data.notificationCooldownSeconds);
    setBrowserNotificationsEnabled(preferencesQuery.data.browserNotificationsEnabled);
    setHasLoadedPreferences(true);
  }, [hasLoadedPreferences, preferencesQuery.data]);

  useEffect(() => {
    if (!('Notification' in window)) return;
    setNotificationPermission(Notification.permission);
  }, []);

  const isValidAbsenceInterval = Number.isInteger(absenceAlertSeconds) && absenceAlertSeconds >= 5 && absenceAlertSeconds <= 3600;

  async function handleBrowserNotificationChange(enabled: boolean) {
    if (!enabled) {
      setBrowserNotificationsEnabled(false);
      return;
    }
    if (notificationPermission === 'unsupported') {
      toast.error('Este navegador não oferece notificações.');
      return;
    }

    let permission = notificationPermission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
    if (permission !== 'granted') {
      toast.error('Permita as notificações no navegador para ativar este recurso.');
      return;
    }
    setBrowserNotificationsEnabled(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidAbsenceInterval || updatePreferences.isPending) return;

    try {
      await updatePreferences.mutateAsync({ absenceAlertSeconds, notificationCooldownSeconds, browserNotificationsEnabled });
      await preferencesQuery.refetch();
      toast.success('Configurações de monitoramento salvas.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar as configurações.');
    }
  }

  if (preferencesQuery.isPending) {
    return (
      <div className="min-h-screen px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl animate-pulse"><div className="h-3 w-32 rounded-full bg-surface-raised" /><div className="mt-4 h-10 w-64 rounded-xl bg-surface-raised" /><div className="mt-8 h-[520px] rounded-[28px] border border-border bg-card" /></div>
      </div>
    );
  }

  const permissionDescription = notificationPermission === 'granted'
    ? 'Permissão concedida neste navegador.'
    : notificationPermission === 'denied'
      ? 'A permissão está bloqueada. Altere-a nas configurações do navegador.'
      : notificationPermission === 'unsupported'
        ? 'Notificações não são suportadas neste navegador.'
        : 'A permissão será solicitada ao ativar esta opção.';

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-[1180px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
        <header className="border-b border-border/80 pb-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Preferências do monitoramento</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-foreground sm:text-4xl">Configurações</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Defina quando o PetVision registra a ausência visual e como deve avisar você durante o monitoramento.</p>
        </header>

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form onSubmit={handleSubmit} className="rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6">
            <div className="flex items-start gap-3 border-b border-border/80 pb-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><Bell className="h-5 w-5" /></span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Alertas visuais</p>
                <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Quando avisar você</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">O alerta só é considerado depois de uma presença confirmada pela câmera.</p>
              </div>
            </div>

            <section className="mt-6 rounded-2xl border border-border/80 bg-surface-raised/45 p-4 sm:p-5">
              <label className="block text-sm font-semibold text-foreground" htmlFor="absence-alert-seconds">Avisar após ausência de</label>
              <div className="mt-3 flex max-w-sm overflow-hidden rounded-xl border border-border bg-card focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                <input id="absence-alert-seconds" type="number" min={5} max={3600} step={5} value={absenceAlertSeconds} onChange={(event) => setAbsenceAlertSeconds(Number(event.target.value))} aria-describedby="absence-alert-help" className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none" />
                <span className="flex items-center border-l border-border px-3 text-sm text-muted-foreground">segundos</span>
              </div>
              <p id="absence-alert-help" className="mt-2 text-xs leading-5 text-muted-foreground">Use de 5 segundos a 60 minutos. Recomendamos 30 segundos para evitar alertas por perdas rápidas de detecção.</p>
              {!isValidAbsenceInterval && <p className="mt-2 text-xs font-semibold text-destructive" role="alert">Informe um intervalo entre 5 e 3.600 segundos.</p>}
            </section>

            <section className="mt-4 border-t border-border/80 pt-5">
              <label className="block text-sm font-semibold text-foreground" htmlFor="notification-cooldown">Evitar alertas repetidos por</label>
              <select id="notification-cooldown" value={notificationCooldownSeconds} onChange={(event) => setNotificationCooldownSeconds(Number(event.target.value))} className="mt-3 h-11 w-full max-w-sm rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15">
                <option value={0}>Sem intervalo adicional</option>
                <option value={60}>1 minuto</option>
                <option value={300}>5 minutos</option>
                <option value={900}>15 minutos</option>
              </select>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Se o pet reaparecer e sair novamente neste período, o evento será salvo, mas uma nova notificação será evitada.</p>
            </section>

            <section className="mt-5 border-t border-border/80 pt-5">
              <div className="flex items-start justify-between gap-5 rounded-2xl border border-border/80 bg-card p-4">
                <div>
                  <label htmlFor="browser-notifications" className="text-sm font-semibold text-foreground">Notificações do navegador</label>
                  <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">Exibe um alerta quando o dashboard estiver aberto e o navegador tiver permissão.</p>
                </div>
                <input id="browser-notifications" type="checkbox" checked={browserNotificationsEnabled} onChange={(event) => void handleBrowserNotificationChange(event.target.checked)} disabled={notificationPermission === 'unsupported'} className="mt-1 h-5 w-5 shrink-0 rounded border-border accent-primary focus:ring-primary/40 disabled:cursor-not-allowed" />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{permissionDescription}</p>
            </section>

            <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-border/80 pt-5">
              <button type="submit" disabled={!isValidAbsenceInterval || updatePreferences.isPending} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_8px_18px_color-mix(in_oklch,var(--primary)_18%,transparent)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"><Check className="h-4 w-4" />{updatePreferences.isPending ? 'Salvando...' : 'Salvar configurações'}</button>
              <p aria-live="polite" className="text-xs leading-5 text-muted-foreground">As mudanças são usadas ao iniciar ou reiniciar o monitoramento.</p>
            </div>
            {preferencesQuery.error && <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive" role="alert">Não foi possível carregar as configurações. Atualize a página para tentar novamente.</p>}
          </form>

          <aside className="self-start rounded-[28px] border border-border/80 bg-card/80 p-5 shadow-[0_12px_35px_oklch(0_0_0_/_0.04)] backdrop-blur-sm sm:p-6">
            <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" /><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Como funciona</p></div>
            <h2 className="mt-3 text-lg font-semibold tracking-[-0.03em] text-card-foreground">Ausência é visual</h2>
            <ol className="mt-5 space-y-4">
              {['O sistema confirma que há um pet no enquadramento.', 'Ao perder essa presença, inicia a contagem configurada.', 'Quando o prazo termina, registra o evento e pode notificar você.'].map((item, index) => <li key={item} className="flex gap-3 text-sm leading-6 text-muted-foreground"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">0{index + 1}</span>{item}</li>)}
            </ol>
            <div className="mt-6 border-t border-border/80 pt-5"><div className="flex items-start gap-2.5"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /><p className="text-xs leading-5 text-muted-foreground">Uma ausência registrada significa que o animal não está visível na fonte ativa, não que deixou fisicamente o ambiente.</p></div></div>
            <Link href="/dashboard/cameras" className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary-hover"><MonitorCog className="h-4 w-4" />Gerenciar câmera padrão</Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
