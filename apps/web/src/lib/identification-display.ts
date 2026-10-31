export type StreamDetection = {
  track_id?: number;
  bbox: { x: number; y: number; width: number; height: number };
  identification?: {
    status: "identified" | "confirming" | "possible" | "unknown";
    pet_id?: string;
    pet_name?: string;
    similarity?: number;
    margin?: number;
  };
};

const OVERLAY_DUPLICATE_CONTAINMENT_THRESHOLD = 0.85;

function intersectionOverSmallerArea(
  first: StreamDetection["bbox"],
  second: StreamDetection["bbox"],
) {
  const left = Math.max(first.x, second.x);
  const top = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const smallerArea = Math.min(first.width * first.height, second.width * second.height);
  return smallerArea > 0 ? intersection / smallerArea : 0;
}

/**
 * Proteção visual: se dois tracks já confirmados representam o mesmo pet e
 * uma caixa está contida na outra, o preview mantém apenas a caixa mais ampla.
 * A supressão principal ocorre no AI Engine; esta camada evita um frame
 * duplicado durante transições do tracker ou respostas defasadas.
 */
export function suppressDuplicateStreamDetections(detections: StreamDetection[]) {
  const visible: StreamDetection[] = [];

  for (const detection of detections) {
    const petId = detection.identification?.pet_id;
    const duplicateIndex = petId
      ? visible.findIndex((candidate) =>
        candidate.identification?.pet_id === petId
        && intersectionOverSmallerArea(candidate.bbox, detection.bbox)
          >= OVERLAY_DUPLICATE_CONTAINMENT_THRESHOLD,
      )
      : -1;

    if (duplicateIndex === -1) {
      visible.push(detection);
      continue;
    }

    const current = visible[duplicateIndex]!;
    const currentArea = current.bbox.width * current.bbox.height;
    const nextArea = detection.bbox.width * detection.bbox.height;
    if (nextArea > currentArea) visible[duplicateIndex] = detection;
  }

  return visible;
}

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
