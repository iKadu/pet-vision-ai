"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Camera, Monitor, Play, Radio, Square, Video } from "lucide-react";

import { trpc } from "@/utils/trpc";

const ENGINE_URL = "http://localhost:8000";

function sourceLabel(source: "webcam" | "screen" | "rtsp") {
  if (source === "webcam") return "Webcam local";
  if (source === "screen") return "Tela do computador";
  return "Câmera IP";
}

export default function CamerasPage() {
  const [source, setSource] = useState<"webcam" | "screen" | "rtsp">("webcam");
  const [rtspUrl, setRtspUrl] = useState("");
  const [cameraName, setCameraName] = useState("");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [changingSource, setChangingSource] = useState(false);
  const camerasQuery = useQuery(trpc.cameras.list.queryOptions());
  const createCamera = useMutation(
    trpc.cameras.create.mutationOptions({
      onSuccess: () => {
        void camerasQuery.refetch();
        setCameraName("");
        setMessage("Câmera salva com sucesso.");
      },
    }),
  );

  function getSourceValue() {
    return source === "webcam" ? "0" : source === "screen" ? "screen" : rtspUrl.trim();
  }

  async function changeSource(nextSource: "webcam" | "screen" | "rtsp") {
    const sourceValue = nextSource === "webcam" ? "0" : nextSource === "screen" ? "screen" : rtspUrl.trim();
    if (nextSource === "rtsp" && !sourceValue.startsWith("rtsp://")) {
      setMessage("Informe uma URL RTSP válida.");
      return;
    }
    setSource(nextSource);
    setChangingSource(true);
    try {
      if (running) {
        const stopResponse = await fetch(`${ENGINE_URL}/stream/stop`, { method: "POST" });
        if (!stopResponse.ok) throw new Error("Não foi possível parar a fonte atual");
      }
      const response = await fetch(`${ENGINE_URL}/stream/source`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: sourceValue }) });
      if (!response.ok) throw new Error("Não foi possível alterar a fonte");
      setRunning(false);
      setMessage(nextSource === "webcam" ? "Webcam selecionada." : nextSource === "screen" ? "Tela do computador selecionada." : "Câmera IP selecionada.");
    } catch {
      setMessage("Não foi possível alterar a fonte do motor local.");
    } finally {
      setChangingSource(false);
    }
  }

  async function toggleStream() {
    if (changingSource) return;
    const action = running ? "stop" : "start";
    try {
      const response = await fetch(`${ENGINE_URL}/stream/${action}`, { method: "POST" });
      if (!response.ok) throw new Error("Não foi possível alterar o monitoramento");
      setRunning(action === "start");
      setMessage(action === "start" ? "Monitoramento iniciado." : "Monitoramento pausado.");
    } catch {
      setMessage("Não foi possível conectar ao motor local.");
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

  return (
    <div className="min-h-screen bg-[#f5f5f3] text-zinc-900">
      <div className="min-h-screen px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 border-b border-zinc-200 pb-7"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Visualização</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Câmeras</h1><p className="mt-2 text-sm text-zinc-500">Escolha a fonte que deseja acompanhar.</p></header>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 shadow-sm"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><h2 className="font-semibold text-white">Pré-visualização</h2><p className="mt-1 text-xs text-zinc-500">{sourceLabel(source)}</p></div><span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${running ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/10 text-zinc-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${running ? "bg-emerald-400" : "bg-zinc-600"}`} />{running ? "Ao vivo" : "Pausado"}</span></div><div className="relative flex aspect-video items-center justify-center overflow-hidden bg-[#10151a]">{running ? <img src={`${ENGINE_URL}/stream/video`} alt={`Pré-visualização: ${sourceLabel(source)}`} className="absolute inset-0 h-full w-full object-cover" /> : <div className="text-center"><Video className="mx-auto h-9 w-9 text-zinc-600" /><p className="mt-4 text-sm text-zinc-400">Inicie o monitoramento para visualizar</p></div>}</div><div className="flex items-center justify-between border-t border-white/10 px-5 py-4"><span className="text-xs text-zinc-500">{message || "O vídeo é processado localmente."}</span><button type="button" onClick={() => void toggleStream()} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200">{running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}{running ? "Parar" : "Iniciar"}</button></div></section>
            <aside className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Fonte de vídeo</h2><p className="mt-1 text-xs leading-5 text-zinc-500">Selecione o que o motor deve analisar.</p><div className="mt-5 space-y-2"><button type="button" disabled={changingSource} onClick={() => void changeSource("webcam")} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${source === "webcam" ? "border-zinc-900 text-zinc-900" : "border-zinc-200 text-zinc-500 hover:border-zinc-400"}`}><Camera className="h-4 w-4" /><span><span className="block text-sm font-medium">Webcam local</span><span className="block text-xs text-zinc-400">Dispositivo 0</span></span></button><button type="button" disabled={changingSource} onClick={() => void changeSource("screen")} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${source === "screen" ? "border-zinc-900 text-zinc-900" : "border-zinc-200 text-zinc-500 hover:border-zinc-400"}`}><Monitor className="h-4 w-4" /><span><span className="block text-sm font-medium">Tela do computador</span><span className="block text-xs text-zinc-400">Captura do monitor selecionado</span></span></button><button type="button" disabled={changingSource} onClick={() => setSource("rtsp")} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${source === "rtsp" ? "border-zinc-900 text-zinc-900" : "border-zinc-200 text-zinc-500 hover:border-zinc-400"}`}><Radio className="h-4 w-4" /><span><span className="block text-sm font-medium">Câmera IP</span><span className="block text-xs text-zinc-400">Transmissão RTSP</span></span></button>{source === "rtsp" && <div className="space-y-2 pt-2"><label htmlFor="rtsp-url" className="text-xs font-medium text-zinc-600">URL RTSP</label><input id="rtsp-url" value={rtspUrl} onChange={(event) => setRtspUrl(event.target.value)} placeholder="rtsp://usuario:senha@ip:554/stream" className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-xs outline-none focus:border-zinc-500" /><button type="button" disabled={changingSource} onClick={() => void changeSource("rtsp")} className="w-full rounded-lg bg-zinc-950 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800">{changingSource ? "Alterando..." : "Salvar fonte IP"}</button></div>}</div><form onSubmit={saveCamera} className="mt-5 border-t border-zinc-100 pt-5"><label htmlFor="camera-name" className="text-xs font-medium text-zinc-600">Nome da câmera</label><input id="camera-name" value={cameraName} onChange={(event) => setCameraName(event.target.value)} placeholder="Ex.: Sala" className="mt-2 h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-500" /><button type="submit" disabled={createCamera.isPending} className="mt-3 w-full rounded-lg bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50">{createCamera.isPending ? "Salvando..." : "Salvar câmera"}</button></form></aside>
          </div>
          {camerasQuery.isSuccess && camerasQuery.data.length > 0 && <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"><div className="flex items-baseline justify-between gap-4"><div><h2 className="font-semibold">Câmeras salvas</h2><p className="mt-1 text-xs text-zinc-500">Fontes disponíveis para este usuário.</p></div><span className="text-xs text-zinc-400">{camerasQuery.data.length} {camerasQuery.data.length === 1 ? "câmera" : "câmeras"}</span></div><div className="mt-4 divide-y divide-zinc-100">{camerasQuery.data.map((camera) => <div key={camera.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="truncate text-sm font-medium text-zinc-800">{camera.name}</p><p className="mt-1 text-xs text-zinc-500">{sourceLabel(camera.type as "webcam" | "screen" | "rtsp")} · {camera.source === "0" ? "Dispositivo 0" : camera.type === "rtsp" ? "URL RTSP configurada" : "Captura de tela"}</p></div><span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Salva</span></div>)}</div></section>}
        </div>
      </div>
    </div>
  );
}
