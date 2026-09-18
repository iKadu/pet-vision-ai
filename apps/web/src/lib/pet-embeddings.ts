import { env } from "@tccpet/env/server";
import { z } from "zod";

export const SUPPORTED_PET_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const embeddingResponse = z.object({
  values: z.array(z.number().finite()).length(512),
  dimensions: z.literal(512),
  model_name: z.string().trim().min(1).max(150),
  pretrained_weights: z.string().trim().min(1).max(150),
  normalized: z.literal(true),
});

export class PetEmbeddingEngineError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export async function generatePetEmbedding(image: Uint8Array, contentType: string) {
  const requestBody = new Uint8Array(image.byteLength);
  requestBody.set(image);

  let response: Response;
  try {
    response = await fetch(`${env.AI_ENGINE_URL}/embeddings/image`, {
      method: "POST",
      headers: { "content-type": contentType },
      body: requestBody.buffer,
    });
  } catch {
    throw new PetEmbeddingEngineError("Motor de IA indisponível", 503);
  }

  if (!response.ok) {
    throw new PetEmbeddingEngineError(
      "Não foi possível gerar o embedding da imagem",
      502,
    );
  }

  const body: unknown = await response.json().catch(() => null);
  const parsed = embeddingResponse.safeParse(body);
  if (!parsed.success) {
    throw new PetEmbeddingEngineError("Resposta inválida do motor de IA", 502);
  }

  return parsed.data;
}
