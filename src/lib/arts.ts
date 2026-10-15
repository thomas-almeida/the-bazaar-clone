// Artes das cartas (imagens e vídeos em /boargame/img) + utilitários.
// Regra: feitiços usam o vídeo do deck (um por mago); as demais, imagem aleatória.

import type { Art, CardDef } from "./types";

const base = "/boargame/img";

export const IMAGE_ARTS: Art[] = [
  { kind: "image", src: `${base}/cover.jpg` },
  { kind: "image", src: `${base}/cover-2.jpg` },
  { kind: "image", src: `${base}/cover-3.jpg` },
  { kind: "image", src: `${base}/cover-4.jpg` },
];

export const VIDEO_ARTS: Art[] = [
  { kind: "video", src: `${base}/video-1.mp4`, poster: `${base}/cover.jpg` },
  { kind: "video", src: `${base}/video-2.mp4`, poster: `${base}/cover-2.jpg` },
  { kind: "video", src: `${base}/video-3.mp4`, poster: `${base}/cover-3.jpg` },
  { kind: "video", src: `${base}/video-4.mp4`, poster: `${base}/cover-4.jpg` },
];

export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function randomImageArt(): Art {
  return IMAGE_ARTS[Math.floor(Math.random() * IMAGE_ARTS.length)];
}

export function randomVideoSrc(): string {
  return VIDEO_ARTS[Math.floor(Math.random() * VIDEO_ARTS.length)].src;
}

// Arte de uma carta: feitiço -> vídeo do deck; caso contrário, imagem aleatória.
export function artFor(def: CardDef, spellVideo?: string): Art {
  if (def.art) return def.art;
  if (def.kind === "spell" && spellVideo) {
    return { kind: "video", src: spellVideo, poster: `${base}/cover.jpg` };
  }
  return randomImageArt();
}

let idCounter = 0;
export function nextId(prefix = "card"): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}
