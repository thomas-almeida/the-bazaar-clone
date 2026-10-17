// Configuração de VFX dos projéteis (editor de efeitos do painel).
// Sem "use client": tipos/validação (mergeVfxConfig, DEFAULT_VFX) são usados
// também pelas rotas de API no servidor. Só a store zustand é consumida no
// cliente, mas isso não exige a diretiva no módulo. É um patch
// leve: um único JSON publicado (GET /api/vfx), sem uploads. O editor edita em
// rascunho local, vê no preview e publica via POST /api/admin/vfx.
//
// Três estilos editáveis, um por tipo de projétil que gera visual:
//  - pistol: tiro reto;
//  - blast:  projétil mágico em curva (com rastro);
//  - sword:  corte melee que surge na badge.
// (heal/shield/haste não lançam projétil; caem no blast como fallback.)

import { create } from "zustand";
import type { AttackStyle } from "./attack-style";

export type VfxMotion = "shot" | "arc" | "melee";
export type VfxStyleKey = "pistol" | "blast" | "sword";
export type VfxShape = "circle" | "diamond" | "triangle" | "square" | "star";

export interface VfxStyle {
  /** Cor base (hex). */
  color: string;
  /** Trajetória. */
  motion: VfxMotion;
  /** Forma geométrica da ponta (o orbe). */
  shape: VfxShape;
  /** Tamanho do orbe/comprimento do corte (px). */
  size: number;
  /** Espessura do feixe/rastro/corte (px). */
  thickness: number;
  /** Velocidade da trajetória: duração em ms (menor = mais rápido). */
  speed: number;
  /** Desfoque (blur) em px. */
  blur: number;
  /** Intensidade do brilho (raio da sombra) em px. */
  glow: number;
  /** Quantidade de fantasmas do rastro (0..10) — relevante na curva. */
  trail: number;
  /** Curvatura do arco (0..0.6) — relevante na curva. */
  bow: number;
}

export type VfxConfig = Record<VfxStyleKey, VfxStyle>;

export const VFX_STYLE_KEYS: VfxStyleKey[] = ["pistol", "blast", "sword"];

export const VFX_STYLE_LABEL: Record<VfxStyleKey, string> = {
  pistol: "Pistola (tiro reto)",
  blast: "Blast (mágico em curva)",
  sword: "Espada (corte melee)",
};

export const VFX_MOTION_LABEL: Record<VfxMotion, string> = {
  shot: "Reto",
  arc: "Curva",
  melee: "Melee (na badge)",
};

export const VFX_SHAPES: VfxShape[] = ["circle", "diamond", "triangle", "square", "star"];

export const VFX_SHAPE_LABEL: Record<VfxShape, string> = {
  circle: "Círculo",
  diamond: "Losango",
  triangle: "Triângulo",
  square: "Quadrado",
  star: "Estrela",
};

// Limites de cada campo numérico (min, max, passo) — usados pelos sliders e pela
// validação do servidor.
export const VFX_LIMITS = {
  size: { min: 4, max: 160, step: 1 },
  thickness: { min: 1, max: 40, step: 1 },
  speed: { min: 80, max: 1200, step: 10 },
  blur: { min: 0, max: 12, step: 0.1 },
  glow: { min: 0, max: 60, step: 1 },
  trail: { min: 0, max: 10, step: 1 },
  bow: { min: 0, max: 0.6, step: 0.01 },
} as const;

// Padrões que reproduzem os visuais atuais do jogo.
export const DEFAULT_VFX: VfxConfig = {
  pistol: { color: "#5bc4ff", motion: "shot", shape: "circle", size: 13, thickness: 2, speed: 220, blur: 0, glow: 18, trail: 0, bow: 0 },
  blast: { color: "#b65cff", motion: "arc", shape: "circle", size: 18, thickness: 13, speed: 440, blur: 2, glow: 26, trail: 6, bow: 0.26 },
  sword: { color: "#ffe8c4", motion: "melee", shape: "circle", size: 118, thickness: 16, speed: 260, blur: 0.6, glow: 30, trail: 0, bow: 0 },
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function num(value: unknown, fallback: number, key: keyof typeof VFX_LIMITS): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const { min, max } = VFX_LIMITS[key];
  return clamp(n, min, max);
}

function mergeStyle(base: VfxStyle, over: Partial<VfxStyle> | undefined): VfxStyle {
  const o = over ?? {};
  const motion: VfxMotion = o.motion === "shot" || o.motion === "arc" || o.motion === "melee" ? o.motion : base.motion;
  const shape: VfxShape = VFX_SHAPES.includes(o.shape as VfxShape) ? (o.shape as VfxShape) : base.shape;
  const color = typeof o.color === "string" && HEX.test(o.color) ? o.color : base.color;
  return {
    color,
    motion,
    shape,
    size: num(o.size, base.size, "size"),
    thickness: num(o.thickness, base.thickness, "thickness"),
    speed: num(o.speed, base.speed, "speed"),
    blur: num(o.blur, base.blur, "blur"),
    glow: num(o.glow, base.glow, "glow"),
    trail: Math.round(num(o.trail, base.trail, "trail")),
    bow: num(o.bow, base.bow, "bow"),
  };
}

/** Combina um config parcial/arbitrário com os padrões, já validado e clampado. */
export function mergeVfxConfig(partial: Partial<Record<VfxStyleKey, Partial<VfxStyle>>> | null | undefined): VfxConfig {
  const p = partial ?? {};
  return {
    pistol: mergeStyle(DEFAULT_VFX.pistol, p.pistol),
    blast: mergeStyle(DEFAULT_VFX.blast, p.blast),
    sword: mergeStyle(DEFAULT_VFX.sword, p.sword),
  };
}

/** Qual chave de VFX um estilo de ataque usa. */
export function vfxKeyForStyle(style: AttackStyle): VfxStyleKey {
  if (style === "pistol") return "pistol";
  if (style === "sword") return "sword";
  return "blast"; // blast e demais (heal/shield/haste não lançam projétil)
}

/** Resolve o VfxStyle para um estilo de ataque a partir de um config. */
export function resolveVfx(style: AttackStyle, config: VfxConfig = DEFAULT_VFX): VfxStyle {
  return config[vfxKeyForStyle(style)];
}

// --- Store do config publicado ---------------------------------------------

interface VfxConfigState {
  config: VfxConfig;
  loaded: boolean;
  load: () => Promise<void>;
  /** Substitui o config em runtime (usado após publicar no painel). */
  set: (config: VfxConfig) => void;
}

export const useVfxConfig = create<VfxConfigState>((set, get) => ({
  config: DEFAULT_VFX,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const res = await fetch("/api/vfx", { cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (res.ok && body) set({ config: mergeVfxConfig(body.config ?? body), loaded: true });
      else set({ loaded: true });
    } catch {
      set({ loaded: true }); // segue com os padrões: VFX não derruba a página
    }
  },
  set: (config) => set({ config: mergeVfxConfig(config), loaded: true }),
}));
