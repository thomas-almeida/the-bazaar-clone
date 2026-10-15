// Magos jogáveis (MAGGI — batalha de magos multidimensional). Cada mago tem um
// deck completo (todos os tipos), mas as cartas das suas CATEGORIAS de
// especialidade são versões mais fortes (+50% valor, −15% cooldown, +40% haste).

import { categoryOf } from "./catalog";
import type { CardDef, ShopCategory } from "./types";

export interface Mage {
  id: string;
  name: string;
  theme: string;
  blurb: string;
  specialties: ShopCategory[];
  video: string; // vídeo usado nos feitiços do deck
  portrait: string; // rosto do mago (badge)
  accent: string;
}

const IMG = "/boargame/img";

export const MAGES: Mage[] = [
  {
    id: "neon",
    name: "NEON",
    theme: "Cyberpunk",
    blurb: "Mago das ruas neon. Esmaga rápido com dano e aceleração.",
    specialties: ["dano", "aceleracao"],
    video: `${IMG}/video-1.mp4`,
    portrait: `${IMG}/mago-1.jpg`,
    accent: "#36e0ff",
  },
  {
    id: "aurea",
    name: "ÁUREA",
    theme: "Medieval",
    blurb: "Clériga de ordem antiga. Sustenta a batalha com cura e aceleração.",
    specialties: ["cura", "aceleracao"],
    video: `${IMG}/video-2.mp4`,
    portrait: `${IMG}/mago-2.jpg`,
    accent: "#ffcf5a",
  },
  {
    id: "ferro",
    name: "FERRO",
    theme: "Velho Oeste",
    blurb: "Pistoleiro blindado. Aguenta tudo com escudo e revida com dano.",
    specialties: ["escudo", "dano"],
    video: `${IMG}/video-3.mp4`,
    portrait: `${IMG}/mago-3.jpg`,
    accent: "#e8a15a",
  },
];

export function getMage(id: string): Mage | undefined {
  return MAGES.find((m) => m.id === id);
}

function boost(def: CardDef): CardDef {
  const next: CardDef = { ...def };
  if (next.damage !== undefined) next.damage = Math.ceil(next.damage * 1.5);
  if (next.effectValue !== undefined) next.effectValue = Math.ceil(next.effectValue * 1.5);
  if (next.cooldown > 0) next.cooldown = Math.max(1, Math.round(next.cooldown * 0.85 * 10) / 10);
  if (next.valueHaste !== undefined) next.valueHaste = Math.round(next.valueHaste * 1.4 * 1000) / 1000;
  if (next.cooldownHaste !== undefined) next.cooldownHaste = Math.round(next.cooldownHaste * 1.4 * 1000) / 1000;
  return next;
}

// Deck do mago: cartas das categorias de especialidade vêm reforçadas.
export function buildMageDeck(mage: Mage, base: CardDef[]): CardDef[] {
  return base.map((def) => (mage.specialties.includes(categoryOf(def)) ? boost(def) : { ...def }));
}
