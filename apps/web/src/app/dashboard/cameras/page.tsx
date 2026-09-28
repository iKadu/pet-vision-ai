"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Camera,
  Check,
  Monitor,
  Pencil,
  Play,
  Radio,
  Square,
  Trash2,
  Video,
  X,
} from "lucide-react";

import { trpc } from "@/utils/trpc";
import { activateAiStream, AI_ENGINE_URL } from "@/lib/ai-stream";
import { StreamDetectionOverlay } from "@/components/stream-detection-overlay";
import { type StreamDetection } from "@/lib/identification-display";

const ENGINE_URL = AI_ENGINE_URL;
const ENGINE_REQUEST_TIMEOUT_MS = 5_000;
type CameraType = "webcam" | "screen" | "rtsp";

type StreamStatus = {
  stream_running: boolean;
  detections: StreamDetection[];
  frame_width: number;
  frame_height: number;
  target_fps: number;
  preview_fps: number;
  capture_fps: number;
  fps: number;
  latency_ms: number;
  cycle_latency_ms: number;
};

function sourceLabel(source: CameraType) {
  if (source === "webcam") return "Webcam local";
  if (source === "screen") return "Tela do computador";
  return "Câmera IP";
}

async function fetchEngine(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    ENGINE_REQUEST_TIMEOUT_MS,
  );

  try {
    return await fetch(`${ENGINE_URL}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default function CamerasPage() {
  const [source, setSource] = useState<CameraType>("webcam");
  const [rtspUrl, setRtspUrl] = useState("");
  const [cameraName, setCameraName] = useState("");
  const [running, setRunning] = useState(false);
  const [isTogglingStream, setIsTogglingStream] = useState(false);
  const [message, setMessage] = useState("");
  const [editingCamera, setEditingCamera] = useState<{
    id: string;
    name: string;
    type: CameraType;
    source: string;
  } | null>(null);
  const camerasQuery = useQuery(trpc.cameras.list.queryOptions());
  const streamStatusQuery = useQuery({
    queryKey: ["ai-stream-status"],
    queryFn: async (): Promise<StreamStatus> => {
      const response = await fetchEngine("/status");
      if (!response.ok) throw new Error("Não foi possível obter o estado do monitoramento");
      return response.json() as Promise<StreamStatus>;
    },
    enabled: running,
    // O vídeo chega continuamente, mas a camada SVG precisa acompanhar os
    // resultados do tracking em uma cadência mais curta que um segundo.
    refetchInterval: running ? 250 : false,
    retry: false,
  });

  // O motor continua processando fora do ciclo de vida desta página. Ao voltar
  // para a aba, recuperamos o estado real em vez de assumir que foi pausado.
  useEffect(() => {
    let cancelled = false;

    async function synchronizeStreamState() {
      try {
        const response = await fetchEngine("/status", { cache: "no-store" });
        if (!response.ok) throw new Error("Estado do motor indisponível");
        const status = (await response.json()) as StreamStatus;
        if (!cancelled) setRunning(Boolean(status.stream_running));
      } catch {
        if (!cancelled) setRunning(false);
      }
    }

    void synchronizeStreamState();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (streamStatusQuery.data) {
      setRunning(Boolean(streamStatusQuery.data.stream_running));
    }
  }, [streamStatusQuery.data]);
  const streamDetections = streamStatusQuery.data?.detections ?? [];
  const frameWidth = streamStatusQuery.data?.frame_width || 16;
  const frameHeight = streamStatusQuery.data?.frame_height || 9;
  const targetFps = streamStatusQuery.data?.target_fps ?? 2;
  const captureFps = streamStatusQuery.data?.capture_fps ?? 0;
  const measuredFps = streamStatusQuery.data?.fps ?? 0;
  const cycleLatency = streamStatusQuery.data?.cycle_latency_ms ?? 0;
  const identifiedCount = streamDetections.filter(
    (detection) => detection.identification?.status === "identified",
  ).length;
  const pendingIdentificationCount = streamDetections.filter(
    (detection) =>
      detection.identification?.status === "confirming" ||
      detection.identification?.status === "possible",
  ).length;
  const createCamera = useMutation(
    trpc.cameras.create.mutationOptions({
      onSuccess: async (camera) => {
        void camerasQuery.refetch();
        setCameraName("");
        if (!camera.isDefault) {
          setMessage("Câmera salva com sucesso.");
          return;
        }
        try {
          await activateAiStream(camera.source);
          setRunning(true);
          void streamStatusQuery.refetch();
          setMessage(`“${camera.name}” foi salva como câmera padrão e está ativa no feed ao vivo.`);
        } catch {
          setMessage(`“${camera.name}” foi salva como padrão, mas não pôde ser iniciada agora.`);
        }
      },
    }),
  );
  const updateCamera = useMutation(
    trpc.cameras.update.mutationOptions({
      onSuccess: () => {
        void camerasQuery.refetch();
        setEditingCamera(null);
        setMessage("Câmera atualizada com sucesso.");
      },
    }),
  );
  const setDefaultCamera = useMutation(trpc.cameras.setDefault.mutationOptions());
  const deleteCamera = useMutation(
    trpc.cameras.delete.mutationOptions({
      onSuccess: (_data, variables) => {
        void camerasQuery.refetch();
        setMessage("Câmera excluída com sucesso.");
      },
    }),
  );

  const defaultCamera = camerasQuery.data?.find((camera) => camera.isDefault);

  useEffect(() => {
    if (!defaultCamera) return;
    setSource(defaultCamera.type as CameraType);
    if (defaultCamera.type === "rtsp") setRtspUrl(defaultCamera.source);
  }, [defaultCamera]);

  function getSourceValue() {
    return source === "webcam"
      ? "0"
      : source === "screen"
        ? "screen"
        : rtspUrl.trim();
  }

  function selectSource(nextSource: CameraType) {
    setSource(nextSource);
    setMessage(
      "Fonte selecionada para configuração. Salve-a e defina-a como padrão para aplicá-la ao feed.",
    );
  }

  async function toggleStream() {
    if (isTogglingStream) return;
    const action = running ? "stop" : "start";
    setIsTogglingStream(true);
    try {
      if (action === "start") {
        await activateAiStream(defaultCamera?.source ?? getSourceValue());
      } else {
        const response = await fetchEngine("/stream/stop", { method: "POST" });
        if (!response.ok) {
          throw new Error("Não foi possível alterar o monitoramento");
        }
      }
      setRunning(action === "start");
      setMessage(
        action === "start"
          ? "Monitoramento iniciado."
          : "Monitoramento pausado.",
      );
    } catch {
      setMessage(
        "O motor local não respondeu. Verifique se o AI Engine está ativo.",
      );
    } finally {
      setIsTogglingStream(false);
    }
  }

  async function setCameraAsDefault(camera: {
    id: string;
    type: string;
    source: string;
    isDefault: boolean;
  }) {
    if (camera.isDefault || setDefaultCamera.isPending) return;
    let preferenceSaved = false;
    try {
      const defaultCamera = await setDefaultCamera.mutateAsync({ id: camera.id });
      preferenceSaved = true;
      setSource(defaultCamera.type as CameraType);
      if (defaultCamera.type === "rtsp") setRtspUrl(defaultCamera.source);
      void camerasQuery.refetch();
      await activateAiStream(defaultCamera.source);
      setRunning(true);
      void streamStatusQuery.refetch();
      setMessage(`“${defaultCamera.name}” agora é a câmera padrão e está ativa no feed ao vivo.`);
    } catch {
      setMessage(
        preferenceSaved
          ? "A preferência foi salva, mas não foi possível iniciar a câmera padrão."
          : "Não foi possível definir a câmera padrão.",
      );
    }
  }

  function saveCamera(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sourceValue = getSourceValue();

    if (!cameraName.trim()) {
      setMessage("Informe um nome para a câmera.");
      return;
    }

    if (source === "rtsp" && !sourceValue.startsWith("rtsp://")) {
      setMessage("Informe uma URL RTSP válida.");
      return;
    }

    createCamera.mutate({
      name: cameraName.trim(),
      type: source,
      source: sourceValue,
    });
  }

  function saveCameraEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCamera?.name.trim() || updateCamera.isPending) return;

    updateCamera.mutate({
      id: editingCamera.id,
      data: {
        name: editingCamera.name.trim(),
        type: editingCamera.type,
        source: editingCamera.source.trim(),
      },
    });
  }

  function removeCamera(id: string) {
    if (deleteCamera.isPending || !window.confirm("Excluir esta câmera?"))
      return;
    deleteCamera.mutate({ id });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="min-h-screen px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 border-b border-border pb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Visualização
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Câmeras
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Configure a fonte que o feed ao vivo deve acompanhar.
            </p>
          </header>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section className="overflow-hidden rounded-xl border border-border bg-zinc-950 shadow-sm">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <h2 className="font-semibold text-white">Pré-visualização</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {defaultCamera ? `${defaultCamera.name} · câmera padrão` : "Nenhuma câmera padrão"}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${running ? "border-primary/30 bg-primary/10 text-primary" : "border-white/10 text-zinc-500"}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${running ? "bg-primary" : "bg-zinc-600"}`}
                  />
                  {running ? "Ao vivo" : "Pausado"}
                </span>
              </div>
              <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-[#10151a]">
                {running ? (
                  <>
                    <img
                      src={`${ENGINE_URL}/stream/video`}
                      alt={`Pré-visualização da câmera padrão${defaultCamera ? `: ${defaultCamera.name}` : ""}`}
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                    <StreamDetectionOverlay
                      detections={streamDetections}
                      frameWidth={frameWidth}
                      frameHeight={frameHeight}
                    />
                    <div
                      aria-live="polite"
                      className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/70 px-3 py-2 text-xs font-medium text-zinc-200 shadow-lg shadow-black/20 backdrop-blur-sm"
                    >
                      {streamStatusQuery.isError
                        ? "Aguardando dados de identificação"
                        : streamDetections.length === 0
                          ? "Aguardando animal"
                          : `${identifiedCount} confirmado${identifiedCount === 1 ? "" : "s"}${pendingIdentificationCount ? ` · ${pendingIdentificationCount} em análise` : ""} · ${streamDetections.length} detectado${streamDetections.length === 1 ? "" : "s"}`}
                    </div>
                    <dl
                      aria-label="Desempenho do monitoramento"
                      className="pointer-events-none absolute bottom-3 right-3 flex divide-x divide-white/10 overflow-hidden rounded-md border border-white/10 bg-black/70 text-xs shadow-lg shadow-black/20 backdrop-blur-sm"
                    >
                      <div className="px-2.5 py-2">
                        <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                          Vídeo
                        </dt>
                        <dd className="mt-0.5 font-semibold tabular-nums text-zinc-100">
                          {captureFps > 0 ? `${captureFps.toFixed(1)} FPS` : "—"}
                        </dd>
                      </div>
                      <div className="px-2.5 py-2">
                        <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                          IA alvo
                        </dt>
                        <dd className="mt-0.5 font-semibold tabular-nums text-zinc-100">
                          {targetFps.toFixed(1)} FPS
                        </dd>
                      </div>
                      <div className="px-2.5 py-2">
                        <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                          Real
                        </dt>
                        <dd className="mt-0.5 font-semibold tabular-nums text-zinc-100">
                          {measuredFps > 0 ? `${measuredFps.toFixed(1)} FPS` : "—"}
                        </dd>
                      </div>
                      <div className="px-2.5 py-2">
                        <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                          Ciclo
                        </dt>
                        <dd className="mt-0.5 font-semibold tabular-nums text-zinc-100">
                          {cycleLatency > 0 ? `${Math.round(cycleLatency)} ms` : "—"}
                        </dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <div className="text-center">
                    <Video className="mx-auto h-9 w-9 text-zinc-600" />
                    <p className="mt-4 text-sm text-zinc-400">
                      Inicie o monitoramento para visualizar
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
                <span className="text-xs text-zinc-500">
                  {message || "O vídeo é processado localmente."}
                </span>
                <button
                  type="button"
                  onClick={() => void toggleStream()}
                  disabled={isTogglingStream}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {running ? (
                    <Square className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" />
                  )}
                  {isTogglingStream
                    ? running
                      ? "Parando..."
                      : "Conectando..."
                    : running
                      ? "Parar"
                      : "Iniciar"}
                </button>
              </div>
            </section>
            <aside className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-semibold">Fonte de vídeo</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Escolha a fonte para salvar ou editar. O motor usa exclusivamente a câmera marcada como padrão.
              </p>
              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  onClick={() => selectSource("webcam")}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${source === "webcam" ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:border-primary/50 hover:bg-surface-raised"}`}
                >
                  <Camera className="h-4 w-4" />
                  <span>
                    <span className="block text-sm font-medium">
                      Webcam local
                    </span>
                    <span className="block text-xs text-zinc-400">
                      Dispositivo 0
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => selectSource("screen")}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${source === "screen" ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:border-primary/50 hover:bg-surface-raised"}`}
                >
                  <Monitor className="h-4 w-4" />
                  <span>
                    <span className="block text-sm font-medium">
                      Tela do computador
                    </span>
                    <span className="block text-xs text-zinc-400">
                      Captura do monitor selecionado
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSource("rtsp")}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${source === "rtsp" ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:border-primary/50 hover:bg-surface-raised"}`}
                >
                  <Radio className="h-4 w-4" />
                  <span>
                    <span className="block text-sm font-medium">Câmera IP</span>
                    <span className="block text-xs text-zinc-400">
                      Transmissão RTSP
                    </span>
                  </span>
                </button>
                {source === "rtsp" && (
                  <div className="space-y-2 pt-2">
                    <label
                      htmlFor="rtsp-url"
                      className="text-xs font-medium text-zinc-600"
                    >
                      URL RTSP
                    </label>
                    <input
                      id="rtsp-url"
                      value={rtspUrl}
                      onChange={(event) => setRtspUrl(event.target.value)}
                      placeholder="rtsp://usuario:senha@ip:554/stream"
                      className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-xs outline-none focus:border-zinc-500"
                    />
                    <button
                      type="button"
                      onClick={() => selectSource("rtsp")}
                      className="w-full rounded-lg bg-zinc-950 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                    >
                      Salvar fonte IP no formulário
                    </button>
                  </div>
                )}
              </div>
              <form
                onSubmit={saveCamera}
                className="mt-5 border-t border-zinc-100 pt-5"
              >
                <label
                  htmlFor="camera-name"
                  className="text-xs font-medium text-zinc-600"
                >
                  Nome da câmera
                </label>
                <input
                  id="camera-name"
                  value={cameraName}
                  onChange={(event) => setCameraName(event.target.value)}
                  placeholder="Ex.: Sala"
                  className="mt-2 h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-500"
                />
                <button
                  type="submit"
                  disabled={createCamera.isPending}
                  className="mt-3 w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createCamera.isPending ? "Salvando..." : "Salvar câmera"}
                </button>
              </form>
            </aside>
          </div>
          {camerasQuery.isSuccess && camerasQuery.data.length > 0 && (
            <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <h2 className="font-semibold">Câmeras salvas</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Fontes disponíveis para este usuário.
                  </p>
                </div>
                <span className="text-xs text-zinc-400">
                  {camerasQuery.data.length}{" "}
                  {camerasQuery.data.length === 1 ? "câmera" : "câmeras"}
                </span>
              </div>
              <div className="mt-4 divide-y divide-zinc-100">
                {camerasQuery.data.map((camera) =>
                  editingCamera?.id === camera.id ? (
                    <form
                      key={camera.id}
                      onSubmit={saveCameraEdit}
                      className="space-y-2 py-3 first:pt-0 last:pb-0"
                    >
                      <input
                        aria-label="Nome da câmera"
                        value={editingCamera.name}
                        onChange={(event) =>
                          setEditingCamera({
                            ...editingCamera,
                            name: event.target.value,
                          })
                        }
                        className="h-9 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-500"
                      />
                      <div className="flex gap-2">
                        <select
                          aria-label="Tipo da câmera"
                          value={editingCamera.type}
                          onChange={(event) =>
                            setEditingCamera({
                              ...editingCamera,
                              type: event.target.value as CameraType,
                            })
                          }
                          className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-xs"
                        >
                          <option value="webcam">Webcam</option>
                          <option value="screen">Tela</option>
                          <option value="rtsp">RTSP</option>
                        </select>
                        <input
                          aria-label="Origem da câmera"
                          value={editingCamera.source}
                          onChange={(event) =>
                            setEditingCamera({
                              ...editingCamera,
                              source: event.target.value,
                            })
                          }
                          className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 text-xs outline-none focus:border-zinc-500"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingCamera(null)}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-500 hover:bg-zinc-100"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={updateCamera.isPending}
                          className="inline-flex items-center gap-1 rounded-lg bg-zinc-950 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Salvar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div
                      key={camera.id}
                      className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-800">
                          {camera.name}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {sourceLabel(camera.type as CameraType)} ·{" "}
                          {camera.source === "0"
                            ? "Dispositivo 0"
                            : camera.type === "rtsp"
                              ? "URL RTSP configurada"
                              : "Captura de tela"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          disabled={camera.isDefault || deleteCamera.isPending || setDefaultCamera.isPending}
                          onClick={() => void setCameraAsDefault(camera)}
                          className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-default ${camera.isDefault ? "bg-success/10 text-success" : "bg-surface-raised text-foreground hover:bg-accent disabled:opacity-50"}`}
                        >
                          {camera.isDefault ? "Padrão ativo" : "Definir padrão"}
                        </button>
                        <button
                          type="button"
                          aria-label={`Editar ${camera.name}`}
                          onClick={() =>
                            setEditingCamera({
                              id: camera.id,
                              name: camera.name,
                              type: camera.type as CameraType,
                              source: camera.source,
                            })
                          }
                          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Excluir ${camera.name}`}
                          onClick={() => removeCamera(camera.id)}
                          className="rounded-lg p-2 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
