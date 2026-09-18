import { appRouter } from "@tccpet/api/routers/index";
import { auth } from "@tccpet/auth";
import { env } from "@tccpet/env/server";
import { TRPCError } from "@trpc/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const requestInput = z.object({
  petId: z.string().uuid(),
  photoUrl: z.string().trim().min(1).max(500),
});

const embeddingResponse = z.object({
  values: z.array(z.number().finite()).length(512),
  dimensions: z.literal(512),
  model_name: z.string().trim().min(1).max(150),
  pretrained_weights: z.string().trim().min(1).max(150),
  normalized: z.literal(true),
});

const contentTypes = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
} as const;

function getUserPhotoPath(photoUrl: string, userId: string) {
  if (!photoUrl.startsWith("/uploads/pets/")) {
    return null;
  }

  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const publicDirectory = path.resolve(process.cwd(), "public");
  const userPhotoDirectory = path.resolve(publicDirectory, "uploads", "pets", safeUserId);
  const filePath = path.resolve(publicDirectory, `.${photoUrl}`);

  if (!filePath.startsWith(`${userPhotoDirectory}${path.sep}`)) {
    return null;
  }

  const contentType = contentTypes[path.extname(filePath).toLowerCase() as keyof typeof contentTypes];
  return contentType ? { filePath, contentType } : null;
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsedInput = requestInput.safeParse(body);
  if (!parsedInput.success) {
    return NextResponse.json({ error: "Dados inválidos para gerar o embedding" }, { status: 400 });
  }

  const photo = getUserPhotoPath(parsedInput.data.photoUrl, session.user.id);
  if (!photo) {
    return NextResponse.json({ error: "Foto do pet inválida" }, { status: 400 });
  }

  let image: Buffer;
  try {
    image = await readFile(photo.filePath);
  } catch {
    return NextResponse.json({ error: "Foto do pet não encontrada" }, { status: 404 });
  }

  let engineResponse: Response;
  try {
    engineResponse = await fetch(`${env.AI_ENGINE_URL}/embeddings/image`, {
      method: "POST",
      headers: { "content-type": photo.contentType },
      body: new Uint8Array(image),
    });
  } catch {
    return NextResponse.json({ error: "Motor de IA indisponível" }, { status: 503 });
  }

  if (!engineResponse.ok) {
    return NextResponse.json({ error: "Não foi possível gerar o embedding da foto" }, { status: 502 });
  }

  const engineBody: unknown = await engineResponse.json().catch(() => null);
  const parsedEmbedding = embeddingResponse.safeParse(engineBody);
  if (!parsedEmbedding.success) {
    return NextResponse.json({ error: "Resposta inválida do motor de IA" }, { status: 502 });
  }

  try {
    const caller = appRouter.createCaller({ auth: null, session });
    const embedding = await caller.pets.createEmbedding({
      petId: parsedInput.data.petId,
      values: parsedEmbedding.data.values,
      modelName: parsedEmbedding.data.model_name,
      pretrainedWeights: parsedEmbedding.data.pretrained_weights,
      sourcePhotoUrl: parsedInput.data.photoUrl,
    });

    return NextResponse.json({ embedding });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Pet não encontrado" }, { status: 404 });
    }

    console.error("Falha ao salvar embedding do pet", error);
    return NextResponse.json({ error: "Não foi possível salvar o embedding" }, { status: 500 });
  }
}
