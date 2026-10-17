// Magos jogáveis (MAGGI — batalha de magos multidimensional). Cada mago tem um
// deck completo (todos os tipos), mas as cartas das suas CATEGORIAS de
// especialidade são versões mais fortes (+50% valor, −15% cooldown, +40% haste).

import { categoryOf } from "./catalog";
import type { CardDef, ShopCategory } from "./types";

export type MagePassive = "slot3" | "heal-adjacent" | "shield-maxhp" | "bleed-wakizashi";

export const PASSIVE_INFO: Record<MagePassive, { label: string; desc: string }> = {
  slot3: {
    label: "IRA",
    desc: "A carta no slot 3 ganha +5% de atributo e cooldown mais rápido. Jogar de SYDRA aumenta o dano de todas as cartas",
  },
  "heal-adjacent": {
    label: "RESSONÂNCIA",
    desc: "Cartas de cura lado a lado têm o efeito multiplicado por 1,2x. Jogar de AURORA aumenta a cura de todas as cartas.",
  },
  "shield-maxhp": {
    label: "MURALHA",
    desc: "Com 2+ itens de escudo na mão, sua vida máxima é dobrada. Jogar de EGBERT aumenta o escudo de todas as cartas.",
  },
  "bleed-wakizashi": {
    label: "SANGRIA",
    desc: "Com uma WAKIZASHI no tabuleiro, YAMATO faz o oponente sangrar — e o sangramento por segundo cresce ao longo da batalha.",
  },
};

export interface Mage {
  id: string;
  name: string;
  theme: string;
  blurb: string;
  specialties: ShopCategory[];
  passive: MagePassive;
  video: string; // vídeo usado nos feitiços do deck
  portrait: string; // rosto do mago (badge)
  /** Recorte do personagem com fundo transparente (PNG), para o efeito pop-out. */
  cutout?: string;
  background: string; // vídeo de fundo do mago (menu/jogo e preview do modal)
  music: string; // trilha do mago (toca no jogo e em preview no modal)
  accent: string;
}

const IMG = "/boargame/img";

export const MAGES: Mage[] = [
  {
    id: "neon",
    name: "SYDRA",
    theme: "Cósmico",
    blurb: "O cadáver vivo do rei de Mamon. Esmaga rápido com dano e aceleração.",
    specialties: ["dano", "aceleracao"],
    passive: "slot3",
    video: `${IMG}/video-1.mp4`,
    portrait: `${IMG}/mago-1.jpg`,
    cutout: `${IMG}/mago-1-no-bg.png`,
    background: `${IMG}/bg-video-homescreen.mp4`,
    music: `${IMG}/maggi-soundtrack-2.mp3`,
    accent: "#d70c0c",
  },
  {
    id: "aurea",
    name: "AURORA",
    theme: "Cyberpunk",
    blurb: "Princesa das Industrias K1LL. Sustenta a batalha com cura e aceleração.",
    specialties: ["cura", "aceleracao"],
    passive: "heal-adjacent",
    video: `${IMG}/video-2.mp4`,
    portrait: `${IMG}/mago-2.jpg`,
    cutout: `${IMG}/mago-2-no-bg.png`,
    background: `${IMG}/bg-video-homescreen-2.mp4`,
    music: `${IMG}/maggi-soundtrack-3.mp3`,
    accent: "#0648ff",
  },
  {
    id: "ferro",
    name: "EGBERT",
    theme: "Medieval",
    blurb: "Rei de Mamon. Usa a força do escudo e revida com dano.",
    specialties: ["escudo", "dano"],
    passive: "shield-maxhp",
    video: `${IMG}/video-2.mp4`,
    portrait: `${IMG}/mago-3.jpg`,
    cutout: `${IMG}/mago-4-no-bg.png`,
    background: `${IMG}/ascii-magic-18.mp4`,
    music: `${IMG}/menu-song.mp3`,
    accent: "#e8a15a",
  },
  {
    id: "yamato",
    name: "YAMATO",
    theme: "Feudal",
    blurb: "Espadachim das lâminas gêmeas. Com a WAKIZASHI em jogo, faz o inimigo sangrar sem parar.",
    specialties: ["dano"],
    passive: "bleed-wakizashi",
    video: `${IMG}/video-1.mp4`,
    portrait: `${IMG}/mago-5.jpg`,
    cutout: `${IMG}/mago-5-no-bg.png`,
    background: `${IMG}/ascii-magic-19.mp4`,
    music: `${IMG}/maggi-soundtrack-2.mp3`,
    accent: "#c01818",
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
