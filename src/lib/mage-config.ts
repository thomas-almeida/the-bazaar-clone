// Overrides de apresentação dos magos (retrato, vídeo de fundo e música),
// editáveis no painel e publicados como um único JSON (GET /api/mages). Patch
// leve, como o de VFX. O gameplay (passiva, deck) continua vindo do código;
// aqui só muda o visual/áudio por mago.
//
// Sem "use client": a validação (mergeMageConfig) roda também no servidor.

import { create } from "zustand";
import { MAGES, type Mage } from "./mages";

export interface MageOverride {
  portrait?: string;
  cutout?: string;
  background?: string;
  music?: string;
}

export type MageConfig = Record<string, MageOverride>;

const MAGE_IDS = new Set(MAGES.map((m) => m.id));

function validPath(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 2048 && value.startsWith("/");
}

function mergeOverride(over: unknown): MageOverride {
  const o = (typeof over === "object" && over !== null ? over : {}) as Record<string, unknown>;
  const out: MageOverride = {};
  if (validPath(o.portrait)) out.portrait = o.portrait;
  if (validPath(o.cutout)) out.cutout = o.cutout;
  if (validPath(o.background)) out.background = o.background;
  if (validPath(o.music)) out.music = o.music;
  return out;
}

/** Normaliza/valida um config arbitrário: só magos conhecidos e caminhos válidos. */
export function mergeMageConfig(partial: unknown): MageConfig {
  const p = (typeof partial === "object" && partial !== null ? partial : {}) as Record<string, unknown>;
  const out: MageConfig = {};
  for (const id of MAGE_IDS) {
    const merged = mergeOverride(p[id]);
    if (Object.keys(merged).length) out[id] = merged;
  }
  return out;
}

/** Aplica os overrides sobre um mago do código. */
export function applyOverride(mage: Mage, config: MageConfig): Mage {
  const o = config[mage.id];
  if (!o) return mage;
  return {
    ...mage,
    portrait: o.portrait ?? mage.portrait,
    cutout: o.cutout ?? mage.cutout,
    background: o.background ?? mage.background,
    music: o.music ?? mage.music,
  };
}

/** Lista de magos com os overrides aplicados. */
export function mergedMages(config: MageConfig): Mage[] {
  return MAGES.map((m) => applyOverride(m, config));
}

// --- Store do config publicado ---------------------------------------------

interface MageConfigState {
  config: MageConfig;
  loaded: boolean;
  load: () => Promise<void>;
  set: (config: MageConfig) => void;
}

export const useMageConfig = create<MageConfigState>((set, get) => ({
  config: {},
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const res = await fetch("/api/mages", { cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (res.ok && body) set({ config: mergeMageConfig(body.config ?? body), loaded: true });
      else set({ loaded: true });
    } catch {
      set({ loaded: true }); // segue com os padrões do código
    }
  },
  set: (config) => set({ config: mergeMageConfig(config), loaded: true }),
}));

/** Hook: magos já com overrides do config publicado aplicados. */
export function useMergedMages(): Mage[] {
  const config = useMageConfig((s) => s.config);
  return mergedMages(config);
}
