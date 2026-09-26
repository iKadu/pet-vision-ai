export type StreamDetection = {
  track_id?: number;
  bbox: { x: number; y: number; width: number; height: number };
  identification?: {
    status: "identified" | "confirming" | "possible" | "unknown";
    pet_name?: string;
    similarity?: number;
    margin?: number;
  };
};

export function identificationDisplay(detection: StreamDetection) {
  const evidence = (identification: StreamDetection["identification"]) => {
    if (!identification?.similarity) return "Evidência visual indisponível";
    const similarity = `Similaridade ${Math.round(identification.similarity * 100)}%`;
    return typeof identification.margin === "number"
      ? `${similarity} · margem +${Math.round(identification.margin * 100)} pts`
      : similarity;
  };

  if (detection.identification?.status === "identified") {
    return {
      accent: "#2dd4bf",
      name: detection.identification.pet_name ?? "Pet cadastrado",
      status: "Identificado",
      detail: evidence(detection.identification),
    };
  }
  if (detection.identification?.status === "confirming") {
    return { accent: "#93c5fd", name: detection.identification.pet_name ?? "Pet candidato", status: "Confirmando identidade", detail: "Aguardando nova leitura consistente" };
  }
  if (detection.identification?.status === "possible") {
    return { accent: "#fbbf24", name: detection.identification.pet_name ?? "Pet candidato", status: "Possível identificação", detail: `${evidence(detection.identification)} · margem insuficiente` };
  }
  if (detection.identification?.status === "unknown") {
    return { accent: "#fbbf24", name: "Nome: —", status: "Não identificado", detail: "Sem referência compatível" };
  }
  return { accent: "#93c5fd", name: "Buscando referência", status: "Analisando", detail: "Aguardando confirmação" };
}
