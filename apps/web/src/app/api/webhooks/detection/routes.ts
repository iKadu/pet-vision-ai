import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    
    console.log("--------------------------------------------------");
    console.log(" [Next.js Webhook] Evento de IA recebido com sucesso!");
    console.log(" Timestamp:", payload.timestamp);
    console.log(" Total de detecções:", payload.detections?.length || 0);
    console.log(" Detalhes:", JSON.stringify(payload.detections, null, 2));
    console.log("--------------------------------------------------");

    return NextResponse.json({
      success: true,
      message: "Evento processado com sucesso",
      receivedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Next.js Webhook] Erro ao processar payload:", error);
    return NextResponse.json(
      { success: false, error: "Formato de payload inválido" },
      { status: 400 }
    );
  }
}