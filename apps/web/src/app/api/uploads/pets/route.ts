import { auth } from "@tccpet/auth";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const allowedTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ error: "Autenticação necessária" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo de imagem" }, { status: 400 });
  }

  const extension = allowedTypes[file.type as keyof typeof allowedTypes];
  if (!extension) {
    return NextResponse.json(
      { error: "Formato inválido. Use JPG, PNG ou WEBP" },
      { status: 400 },
    );
  }

  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "A imagem deve ter até 5 MB" },
      { status: 400 },
    );
  }

  const safeUserId = session.user.id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${randomUUID()}.${extension}`;
  const relativeDirectory = path.join("uploads", "pets", safeUserId);
  const directory = path.join(process.cwd(), "public", relativeDirectory);

  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({
    url: `/${relativeDirectory.replaceAll(path.sep, "/")}/${fileName}`,
  });
}
