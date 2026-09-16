"use client";

import { useState } from "react";
import { Camera, Monitor, Play, Square, Video } from "lucide-react";

import { Sidebar } from "../dashboard-home";

const ENGINE_URL = "http://localhost:8000";

export default function CamerasPage() {
  const [source, setSource] = useState<"webcam" | "screen">("webcam");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  async function changeSource(nextSource: "webcam" | "screen") {
    const sourceValue = nextSource === "webcam" ? "0" : "screen";
    try {
      const response = await fetch(`${ENGINE_URL}/stream/source`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: sourceValue }) });
      if (!response.ok) throw new Error("Não foi possível alterar a fonte");
      setSource(nextSource);
      setRunning(false);
      setMessage(nextSource === "webcam" ? "Webcam selecionada." : "Tela do computador selecionada.");
    } catch {
      setMessage("Não foi possível alterar a fonte do motor local.");
    }
  }

  async function toggleStream() {
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

  return (
    <main className="min-h-screen bg-[#f5f5f3] text-zinc-900">
      <Sidebar />
      <div className="ml-56 min-h-screen px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 border-b border-zinc-200 pb-7"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Visualização</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Câmeras</h1><p className="mt-2 text-sm text-zinc-500">Escolha a fonte que deseja acompanhar.</p></header>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 shadow-sm"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><h2 className="font-semibold text-white">Pré-visualização</h2><p className="mt-1 text-xs text-zinc-500">{source === "webcam" ? "Webcam local" : "Tela do computador"}</p></div><span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${running ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/10 text-zinc-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${running ? "bg-emerald-400" : "bg-zinc-600"}`} />{running ? "Ao vivo" : "Pausado"}</span></div><div className="relative flex aspect-video items-center justify-center overflow-hidden bg-[#10151a]">{running ? <img src={`${ENGINE_URL}/stream/video`} alt="Pré-visualização da fonte selecionada" className="absolute inset-0 h-full w-full object-cover" /> : <div className="text-center"><Video className="mx-auto h-9 w-9 text-zinc-600" /><p className="mt-4 text-sm text-zinc-400">Inicie o monitoramento para visualizar</p></div>}</div><div className="flex items-center justify-between border-t border-white/10 px-5 py-4"><span className="text-xs text-zinc-500">{message || "O vídeo é processado localmente."}</span><button type="button" onClick={() => void toggleStream()} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200">{running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}{running ? "Parar" : "Iniciar"}</button></div></section>
            <aside className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Fonte de vídeo</h2><p className="mt-1 text-xs leading-5 text-zinc-500">Selecione o que o motor deve analisar.</p><div className="mt-5 space-y-2"><button type="button" onClick={() => void changeSource("webcam")} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${source === "webcam" ? "border-zinc-900 text-zinc-900" : "border-zinc-200 text-zinc-500 hover:border-zinc-400"}`}><Camera className="h-4 w-4" /><span><span className="block text-sm font-medium">Webcam</span><span className="block text-xs text-zinc-400">Câmera conectada ao computador</span></span></button><button type="button" onClick={() => void changeSource("screen")} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${source === "screen" ? "border-zinc-900 text-zinc-900" : "border-zinc-200 text-zinc-500 hover:border-zinc-400"}`}><Monitor className="h-4 w-4" /><span><span className="block text-sm font-medium">Tela do computador</span><span className="block text-xs text-zinc-400">Captura do monitor selecionado</span></span></button></div></aside>
          </div>
        </div>
      </div>
    </main>
  );
}
