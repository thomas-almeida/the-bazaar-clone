import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, unauthorizedResponse } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_UPLOAD_SIZE = 8 * 1024 * 1024;

function detectImage(buffer: Buffer): { extension: string; mime: string } | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { extension: "png", mime: "image/png" };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: "jpg", mime: "image/jpeg" };
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return { extension: "webp", mime: "image/webp" };
  }
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6))) {
    return { extension: "gif", mime: "image/gif" };
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAdminRequest(request)) return unauthorizedResponse();
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json({ error: "O upload local de artes só está disponível em desenvolvimento." }, { status: 403 });
    }
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_SIZE + 64 * 1024) {
      return NextResponse.json({ error: "A requisição excede o limite de upload." }, { status: 413 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Selecione um arquivo de imagem." }, { status: 400 });
    if (file.size < 1 || file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: "A imagem deve ter no máximo 8 MB." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const image = detectImage(bytes);
    if (!image || file.type !== image.mime) {
      return NextResponse.json({ error: "Formato de imagem não suportado ou arquivo inválido." }, { status: 400 });
    }

    const directory = path.join(process.cwd(), "public", "card-art");
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}.${image.extension}`;
    await writeFile(path.join(directory, filename), bytes, { flag: "wx" });
    return NextResponse.json({ art: { kind: "image", src: `/card-art/${filename}` } }, { status: 201 });
  } catch (error) {
    console.error("Unable to store local card art:", error);
    return NextResponse.json({ error: "Não foi possível armazenar a arte localmente." }, { status: 500 });
  }
}
