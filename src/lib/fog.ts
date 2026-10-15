"use client";

// Mecânica de névoa (sandstorm). Depois de FOG_START_MS de combate, a névoa
// chega e aplica FOG_DPS de dano por segundo a AMBOS os lados (direto na vida,
// ignorando escudo, para encerrar batalhas longas). Alguns segundos antes
// (FOG_WARN_MS) um aviso é exibido (a linha azul + contagem). O estado é
// publicado neste store leve, consumido por FogTimerLine e FogOverlay.

import { create } from "zustand";

export const FOG_START_MS = 60000; // 1 minuto de batalha
export const FOG_WARN_MS = 8000; // aviso 8s antes
// Incremento de dano por segundo: o dano da névoa escala infinitamente
// (1, 2, 3, ... por tique) e só para quando uma das vidas chega a zero.
export const FOG_DMG_STEP = 1;

export type FogStatus = "idle" | "warning" | "active";

interface FogStore {
  status: FogStatus;
  remaining: number; // segundos até a névoa (durante o aviso)
  damage: number; // dano atual por segundo (escala durante a névoa ativa)
  gust: number; // incrementa ao ativar, para disparar a animação de vendaval
  reset: () => void;
}

export const useFog = create<FogStore>((set) => ({
  status: "idle",
  remaining: 0,
  damage: 0,
  gust: 0,
  reset: () => set({ status: "idle", remaining: 0, damage: 0 }),
}));
