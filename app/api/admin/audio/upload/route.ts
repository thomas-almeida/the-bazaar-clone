// Upload local de arquivos de som, espelhando app/api/admin/art. Só funciona em
// desenvolvimento: grava em public/sounds/upload/ e devolve o caminho, que o
// admin salva no patch. Para o arquivo existir em produção, ele precisa ser
// commitado no Git — o filesystem do servidor de produção não é usado.

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, unauthorizedResponse } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_UPLOAD_SIZE = 8 * 1024 * 1024;

function detectAudio(buffer: Buffer): { extension: string; mime: string } | null {
  const ascii = (start: number, length: number) => buffer.toString("ascii", start, start + length);
  if (buffer.length >= 3 && ascii(0, 3) === "ID3") return { extension: "mp3", mime: "audio/mpeg" };
  // Frame sync MPEG: 0xFF seguido de 11 bits set (0xE0).
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return { extension: "mp3", mime: "audio/mpeg" };
  }
  if (buffer.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") {
    return { extension: "wav", mime: "audio/wav" };
  }
  if (buffer.length >= 4 && ascii(0, 4) === "OggS") return { extension: "ogg", mime: "audio/ogg" };
  if (buffer.length >= 4 && ascii(0, 4) === "fLaC") return { extension: "flac", mime: "audio/flac" };
  if (buffer.length >= 12 && ascii(4, 4) === "ftyp") return { extension: "m4a", mime: "audio/mp4" };
  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAdminRequest(request)) return unauthorizedResponse();
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        { error: "O upload local de sons só está disponível em desenvolvimento." },
        { status: 403 },
      );
    }
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_SIZE + 64 * 1024) {
      return NextResponse.json({ error: "A requisição excede o limite de upload." }, { status: 413 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Selecione um arquivo de áudio." }, { status: 400 });
    if (file.size < 1 || file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: "O arquivo deve ter no máximo 8 MB." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const audio = detectAudio(bytes);
    if (!audio || file.type !== audio.mime) {
      return NextResponse.json({ error: "Formato de áudio não suportado ou arquivo inválido." }, { status: 400 });
    }

    const directory = path.join(process.cwd(), "public", "sounds", "upload");
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}.${audio.extension}`;
    await writeFile(path.join(directory, filename), bytes, { flag: "wx" });
    return NextResponse.json({ path: `/sounds/upload/${filename}` }, { status: 201 });
  } catch (error) {
    console.error("Unable to store local sound file:", error);
    return NextResponse.json({ error: "Não foi possível armazenar o som localmente." }, { status: 500 });
  }
}
