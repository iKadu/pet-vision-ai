"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, Check, Clock3, MonitorCog } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

const DEFAULT_PREFERENCES = {
  absenceAlertSeconds: 30,
  notificationCooldownSeconds: 300,
  browserNotificationsEnabled: false,
};

function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds} segundos`;
  const minutes = seconds / 60;
  return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}

export default function SettingsPage() {
  const preferencesQuery = useQuery(
    trpc.monitoringPreferences.get.queryOptions(),
  );
  const updatePreferences = useMutation(
    trpc.monitoringPreferences.update.mutationOptions(),
  );
  const [absenceAlertSeconds, setAbsenceAlertSeconds] = useState(
    DEFAULT_PREFERENCES.absenceAlertSeconds,
  );
  const [notificationCooldownSeconds, setNotificationCooldownSeconds] = useState(
    DEFAULT_PREFERENCES.notificationCooldownSeconds,
  );
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(
    DEFAULT_PREFERENCES.browserNotificationsEnabled,
  );
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    if (hasLoadedPreferences || !preferencesQuery.data) return;
    setAbsenceAlertSeconds(preferencesQuery.data.absenceAlertSeconds);
    setNotificationCooldownSeconds(
      preferencesQuery.data.notificationCooldownSeconds,
    );
    setBrowserNotificationsEnabled(
      preferencesQuery.data.browserNotificationsEnabled,
    );
    setHasLoadedPreferences(true);
  }, [hasLoadedPreferences, preferencesQuery.data]);

  useEffect(() => {
    if (!("Notification" in window)) return;
    setNotificationPermission(Notification.permission);
  }, []);

  const isValidAbsenceInterval =
    Number.isInteger(absenceAlertSeconds) &&
    absenceAlertSeconds >= 5 &&
    absenceAlertSeconds <= 3600;

  async function handleBrowserNotificationChange(enabled: boolean) {
    if (!enabled) {
      setBrowserNotificationsEnabled(false);
      return;
    }

    if (notificationPermission === "unsupported") {
      toast.error("Este navegador não oferece notificações.");
      return;
    }

    let permission = notificationPermission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }

    if (permission !== "granted") {
      toast.error("Permita as notificações no navegador para ativar este recurso.");
      return;
    }

    setBrowserNotificationsEnabled(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidAbsenceInterval || updatePreferences.isPending) return;

    try {
      await updatePreferences.mutateAsync({
        absenceAlertSeconds,
        notificationCooldownSeconds,
        browserNotificationsEnabled,
      });
      await preferencesQuery.refetch();
      toast.success("Configurações de monitoramento salvas.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar as configurações.",
      );
    }
  }

  if (preferencesQuery.isPending) {
    return (
      <div className="min-h-screen px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl animate-pulse">
          <div className="h-9 w-56 rounded-md bg-surface-raised" />
          <div className="mt-3 h-5 w-96 max-w-full rounded-md bg-surface-raised" />
          <div className="mt-10 h-96 rounded-xl border border-border bg-card" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <header className="border-b border-border pb-7">
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-foreground">
            Configurações
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Defina como o PetVision reage quando um animal deixa o campo de visão.
          </p>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-foreground">
                <Bell className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-semibold text-foreground">Alertas de monitoramento</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  O alerta só é criado depois de uma presença confirmada na câmera.
                </p>
              </div>
            </div>

            <div className="mt-7 border-y border-border py-6">
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="absence-alert-seconds"
              >
                Avisar após ausência de
              </label>
              <div className="mt-2 flex max-w-xs items-center rounded-lg border border-border bg-card focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                <input
                  id="absence-alert-seconds"
                  type="number"
                  min={5}
                  max={3600}
                  step={5}
                  value={absenceAlertSeconds}
                  onChange={(event) =>
                    setAbsenceAlertSeconds(Number(event.target.value))
                  }
                  aria-describedby="absence-alert-help"
                  className="h-10 min-w-0 flex-1 rounded-l-lg px-3 text-sm outline-none"
                />
                <span className="border-l border-border px-3 text-sm text-muted-foreground">
                  segundos
                </span>
              </div>
              <p id="absence-alert-help" className="mt-2 text-xs leading-5 text-muted-foreground">
                Use de 5 segundos a 60 minutos. Recomendamos 30 segundos para
                evitar alertas por perdas rápidas de detecção.
              </p>
              {!isValidAbsenceInterval && (
                <p className="mt-2 text-xs font-medium text-destructive" role="alert">
                  Informe um intervalo entre 5 e 3.600 segundos.
                </p>
              )}
            </div>

            <div className="py-6">
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="notification-cooldown"
              >
                Evitar alertas repetidos por
              </label>
              <select
                id="notification-cooldown"
                value={notificationCooldownSeconds}
                onChange={(event) =>
                  setNotificationCooldownSeconds(Number(event.target.value))
                }
                className="mt-2 h-10 w-full max-w-xs rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value={0}>Sem intervalo adicional</option>
                <option value={60}>1 minuto</option>
                <option value={300}>5 minutos</option>
                <option value={900}>15 minutos</option>
              </select>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Se o pet reaparecer e sair novamente neste período, o evento será
                salvo, mas uma nova notificação será evitada.
              </p>
            </div>

            <div className="border-t border-border pt-6">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <label
                    htmlFor="browser-notifications"
                    className="text-sm font-medium text-foreground"
                  >
                    Notificações do navegador
                  </label>
                  <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                    Mostra um alerta quando o dashboard estiver aberto e o navegador
                    tiver permissão.
                  </p>
                </div>
                <input
                  id="browser-notifications"
                  type="checkbox"
                  checked={browserNotificationsEnabled}
                  onChange={(event) =>
                    void handleBrowserNotificationChange(event.target.checked)
                  }
                  disabled={notificationPermission === "unsupported"}
                  className="mt-1 h-4 w-4 rounded border-border text-foreground focus:ring-primary/40 disabled:cursor-not-allowed"
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {notificationPermission === "granted"
                  ? "Permissão concedida neste navegador."
                  : notificationPermission === "denied"
                    ? "A permissão está bloqueada. Altere-a nas configurações do navegador."
                    : notificationPermission === "unsupported"
                      ? "Notificações não são suportadas neste navegador."
                      : "A permissão será solicitada ao ativar esta opção."}
              </p>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-border pt-5">
              <button
                type="submit"
                disabled={!isValidAbsenceInterval || updatePreferences.isPending}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check className="h-4 w-4" />
                {updatePreferences.isPending ? "Salvando..." : "Salvar configurações"}
              </button>
              <p aria-live="polite" className="text-xs text-muted-foreground">
                As mudanças são usadas ao iniciar ou reiniciar o monitoramento.
              </p>
            </div>

            {preferencesQuery.error && (
              <p className="mt-4 text-sm text-destructive" role="alert">
                Não foi possível carregar as configurações. Atualize a página para tentar novamente.
              </p>
            )}
          </form>

          <aside className="self-start rounded-xl border border-border bg-surface-raised p-5">
            <div className="flex items-center gap-2 text-foreground">
              <Clock3 className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Como funciona</h2>
            </div>
            <ol className="mt-4 space-y-4 text-sm leading-6 text-muted-foreground">
              <li>O sistema confirma que há um pet no enquadramento.</li>
              <li>Ao perder essa presença, inicia a contagem configurada.</li>
              <li>Quando o prazo termina, registra o evento e pode notificar você.</li>
            </ol>
            <div className="mt-5 border-t border-border pt-4">
              <a
                href="/dashboard/cameras"
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground transition hover:text-foreground"
              >
                <MonitorCog className="h-4 w-4" />
                Gerenciar câmera padrão
              </a>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
