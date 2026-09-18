import { appRouter } from "@tccpet/api/routers/index";
import { auth } from "@tccpet/auth";
import {
  generatePetEmbedding,
  PetEmbeddingEngineError,
  SUPPORTED_PET_IMAGE_CONTENT_TYPES,
} from "@/lib/pet-embeddings";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0] ?? "";
  if (!SUPPORTED_PET_IMAGE_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: "Formato inválido. Use JPG, PNG ou WEBP" },
      { status: 415 },
    );
  }

  const image = new Uint8Array(await request.arrayBuffer());
  if (image.byteLength === 0 || image.byteLength > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "A imagem deve ter até 5 MB" },
      { status: 413 },
    );
  }

  try {
    const embedding = await generatePetEmbedding(image, contentType);
    const caller = appRouter.createCaller({ auth: null, session });
    const result = await caller.pets.findSimilarEmbedding({
      values: embedding.values,
      modelName: embedding.model_name,
      pretrainedWeights: embedding.pretrained_weights,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PetEmbeddingEngineError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Falha ao identificar o pet pela imagem", error);
    return NextResponse.json({ error: "Não foi possível identificar o pet" }, { status: 500 });
  }
}
