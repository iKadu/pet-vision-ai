"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
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

const ENGINE_URL = "http://localhost:8000";
type CameraType = "webcam" | "screen" | "rtsp";

type StreamDetection = {
  track_id?: number;
  bbox: { x: number; y: number; width: number; height: number };
  identification?: {
    status: "identified" | "unknown";
    pet_name?: string;
    similarity?: number;
  };
};

type StreamStatus = {
  detections: StreamDetection[];
  frame_width: number;
  frame_height: number;
};

function sourceLabel(source: CameraType) {
  if (source === "webcam") return "Webcam local";
  if (source === "screen") return "Tela do computador";
  return "Câmera IP";
}

function identificationLabel(detection: StreamDetection) {
  if (detection.identification?.status === "identified") {
    const confidence = detection.identification.similarity
      ? ` · ${Math.round(detection.identification.similarity * 100)}%`
      : "";
    return `${detection.identification.pet_name ?? "Pet"}${confidence}`;
  }

  return detection.identification?.status === "unknown"
    ? "Não identificado"
    : "Analisando";
}

export default function CamerasPage() {
  const [source, setSource] = useState<CameraType>("webcam");
  const [rtspUrl, setRtspUrl] = useState("");
  const [cameraName, setCameraName] = useState("");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [changingSource, setChangingSource] = useState(false);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
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
      const response = await fetch(`${ENGINE_URL}/status`);
      if (!response.ok) throw new Error("Não foi possível obter o estado do monitoramento");
      return response.json() as Promise<StreamStatus>;
    },
    enabled: running,
    refetchInterval: running ? 1000 : false,
    retry: false,
  });
  const streamDetections = streamStatusQuery.data?.detections ?? [];
  const frameWidth = streamStatusQuery.data?.frame_width || 16;
  const frameHeight = streamStatusQuery.data?.frame_height || 9;
  const identifiedCount = streamDetections.filter(
    (detection) => detection.identification?.status === "identified",
  ).length;
  const createCamera = useMutation(
    trpc.cameras.create.mutationOptions({
      onSuccess: () => {
        void camerasQuery.refetch();
        setCameraName("");
        setMessage("Câmera salva com sucesso.");
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
  const deleteCamera = useMutation(
    trpc.cameras.delete.mutationOptions({
      onSuccess: (_data, variables) => {
        void camerasQuery.refetch();
        if (activeCameraId === variables.id) setActiveCameraId(null);
        setMessage("Câmera excluída com sucesso.");
      },
    }),
  );

  function getSourceValue() {
    return source === "webcam"
      ? "0"
      : source === "screen"
        ? "screen"
        : rtspUrl.trim();
  }

  async function changeSource(nextSource: CameraType, sourceOverride?: string) {
    const sourceValue =
      sourceOverride ??
      (nextSource === "webcam"
        ? "0"
        : nextSource === "screen"
          ? "screen"
          : rtspUrl.trim());
    if (nextSource === "rtsp" && !sourceValue.startsWith("rtsp://")) {
      setMessage("Informe uma URL RTSP válida.");
      return;
    }
    setActiveCameraId(null);
    setSource(nextSource);
    setChangingSource(true);
    try {
      if (running) {
        const stopResponse = await fetch(`${ENGINE_URL}/stream/stop`, {
          method: "POST",
        });
        if (!stopResponse.ok)
          throw new Error("Não foi possível parar a fonte atual");
      }
      const response = await fetch(`${ENGINE_URL}/stream/source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: sourceValue }),
      });
      if (!response.ok) throw new Error("Não foi possível alterar a fonte");
      setRunning(false);
      setMessage(
        nextSource === "webcam"
          ? "Webcam selecionada."
          : nextSource === "screen"
            ? "Tela do computador selecionada."
            : "Câmera IP selecionada.",
      );
      return true;
    } catch {
      setMessage("Não foi possível alterar a fonte do motor local.");
      return false;
    } finally {
      setChangingSource(false);
    }
  }

  async function toggleStream() {
    if (changingSource) return;
    const action = running ? "stop" : "start";
    try {
      const tokenResponse =
        action === "start"
          ? await fetch("/api/ai/stream-token", { method: "POST" })
          : null;
      const tokenResult = tokenResponse
        ? ((await tokenResponse.json()) as { token?: string; error?: string })
        : null;
      if (tokenResponse && (!tokenResponse.ok || !tokenResult?.token)) {
        throw new Error(
          tokenResult?.error ?? "Não foi possível autorizar o monitoramento",
        );
      }

      const response = await fetch(`${ENGINE_URL}/stream/${action}`, {
        method: "POST",
        headers:
          action === "start"
            ? { "Content-Type": "application/json" }
            : undefined,
        body:
          action === "start"
            ? JSON.stringify({ stream_token: tokenResult?.token })
            : undefined,
      });
      if (!response.ok)
        throw new Error("Não foi possível alterar o monitoramento");
      setRunning(action === "start");
      setMessage(
        action === "start"
          ? "Monitoramento iniciado."
          : "Monitoramento pausado.",
      );
    } catch {
      setMessage("Não foi possível conectar ao motor local.");
    }
  }

  async function useSavedCamera(camera: {
    id: string;
    type: string;
    source: string;
  }) {
    if (!(["webcam", "screen", "rtsp"] as string[]).includes(camera.type)) {
      setMessage("Esta câmera possui um tipo inválido.");
      return;
    }

    const cameraType = camera.type as CameraType;
    if (cameraType === "rtsp") setRtspUrl(camera.source);
    if (await changeSource(cameraType, camera.source))
      setActiveCameraId(camera.id);
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
    <div className="min-h-screen bg-[#f5f5f3] text-zinc-900">
      <div className="min-h-screen px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 border-b border-zinc-200 pb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Visualização
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Câmeras
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Escolha a fonte que deseja acompanhar.
            </p>
          </header>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 shadow-sm">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <h2 className="font-semibold text-white">Pré-visualização</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {sourceLabel(source)}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${running ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/10 text-zinc-500"}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${running ? "bg-emerald-400" : "bg-zinc-600"}`}
                  />
                  {running ? "Ao vivo" : "Pausado"}
                </span>
              </div>
              <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-[#10151a]">
                {running ? (
                  <>
                    <img
                      src={`${ENGINE_URL}/stream/video`}
                      alt={`Pré-visualização: ${sourceLabel(source)}`}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <svg
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 h-full w-full"
                      viewBox={`0 0 ${frameWidth} ${frameHeight}`}
                      preserveAspectRatio="xMidYMid slice"
                    >
                      {streamDetections.map((detection, index) => {
                        const identified = detection.identification?.status === "identified";
                        const color = identified ? "#5eead4" : "#fbbf24";
                        const label = identificationLabel(detection);

                        return (
                          <g key={detection.track_id ?? index}>
                            <rect
                              x={detection.bbox.x * frameWidth}
                              y={detection.bbox.y * frameHeight}
                              width={detection.bbox.width * frameWidth}
                              height={detection.bbox.height * frameHeight}
                              fill="none"
                              stroke={color}
                              strokeWidth="3"
                              vectorEffect="non-scaling-stroke"
                            />
                            <rect
                              x={detection.bbox.x * frameWidth}
                              y={detection.bbox.y * frameHeight}
                              width={frameWidth * 0.34}
                              height={frameHeight * 0.06}
                              rx={frameHeight * 0.01}
                              fill="#09090b"
                              fillOpacity="0.86"
                            />
                            <text
                              x={(detection.bbox.x + 0.014) * frameWidth}
                              y={(detection.bbox.y + 0.039) * frameHeight}
                              fill={color}
                              fontSize={frameHeight * 0.031}
                              fontWeight="600"
                            >
                              {label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                    <div
                      aria-live="polite"
                      className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/70 px-3 py-2 text-xs font-medium text-zinc-200 shadow-lg shadow-black/20 backdrop-blur-sm"
                    >
                      {streamStatusQuery.isError
                        ? "Aguardando dados de identificação"
                        : streamDetections.length === 0
                          ? "Aguardando animal"
                          : `${identifiedCount} identificado${identifiedCount === 1 ? "" : "s"} · ${streamDetections.length} detectado${streamDetections.length === 1 ? "" : "s"}`}
                    </div>
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
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
                >
                  {running ? (
                    <Square className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" />
                  )}
                  {running ? "Parar" : "Iniciar"}
                </button>
              </div>
            </section>
            <aside className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Fonte de vídeo</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Selecione o que o motor deve analisar.
              </p>
              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  disabled={changingSource}
                  onClick={() => void changeSource("webcam")}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${source === "webcam" ? "border-zinc-900 text-zinc-900" : "border-zinc-200 text-zinc-500 hover:border-zinc-400"}`}
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
                  disabled={changingSource}
                  onClick={() => void changeSource("screen")}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${source === "screen" ? "border-zinc-900 text-zinc-900" : "border-zinc-200 text-zinc-500 hover:border-zinc-400"}`}
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
                  disabled={changingSource}
                  onClick={() => setSource("rtsp")}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${source === "rtsp" ? "border-zinc-900 text-zinc-900" : "border-zinc-200 text-zinc-500 hover:border-zinc-400"}`}
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
                      disabled={changingSource}
                      onClick={() => void changeSource("rtsp")}
                      className="w-full rounded-lg bg-zinc-950 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                    >
                      {changingSource ? "Alterando..." : "Salvar fonte IP"}
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
                  className="mt-3 w-full rounded-lg bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createCamera.isPending ? "Salvando..." : "Salvar câmera"}
                </button>
              </form>
            </aside>
          </div>
          {camerasQuery.isSuccess && camerasQuery.data.length > 0 && (
            <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
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
                          disabled={changingSource || deleteCamera.isPending}
                          onClick={() => void useSavedCamera(camera)}
                          className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${activeCameraId === camera.id ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
                        >
                          {activeCameraId === camera.id ? "Em uso" : "Usar"}
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
                          className="rounded-lg p-2 text-zinc-400 hover:text-rose-600"
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
