import { Dog } from "lucide-react";

import { Sidebar } from "../dashboard-home";

export default function AnimalsPage() {
  return (
    <main className="min-h-screen bg-[#f5f5f3] text-zinc-900">
      <Sidebar />
      <div className="ml-56 px-5 py-10 sm:px-8 lg:px-10"><div className="mx-auto max-w-4xl">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
          <Dog className="h-5 w-5 text-zinc-500" />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Animais</h1>
          <p className="mt-2 text-sm text-zinc-500">O cadastro dos seus animais ficará disponível nesta área.</p>
        </div>
      </div></div>
    </main>
  );
}
