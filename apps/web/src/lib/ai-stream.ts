export const AI_ENGINE_URL = "http://localhost:8000";

/** Configura uma fonte e garante que o único stream do motor esteja em execução. */
export async function activateAiStream(source: string) {
  const sourceResponse = await fetch(`${AI_ENGINE_URL}/stream/source`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
  });
  if (!sourceResponse.ok) throw new Error("Não foi possível configurar a câmera.");

  const tokenResponse = await fetch("/api/ai/stream-token", { method: "POST" });
  const tokenResult = (await tokenResponse.json()) as { token?: string };
  if (!tokenResponse.ok || !tokenResult.token) {
    throw new Error("Não foi possível autorizar a câmera.");
  }

  const startResponse = await fetch(`${AI_ENGINE_URL}/stream/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stream_token: tokenResult.token }),
  });
  if (!startResponse.ok) throw new Error("Não foi possível iniciar a câmera.");
}
