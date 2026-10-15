"use client";

// Store leve de projéteis cosméticos. O motor de combate chama spawn() quando
// uma carta de dano dispara; a camada <ProjectileLayer/> renderiza e remove.
// O dano em si continua sendo aplicado no store do jogo no instante do disparo;
// o projétil é apenas visual e dispara o tremor/flash da badge ao impactar.

import { create } from "zustand";
import type { Side } from "./types";

export interface Projectile {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  targetSide: Side; // badge que treme/pisca no impacto
  duration: number; // ms
}

interface ProjectileState {
  projectiles: Projectile[];
  spawn: (p: Omit<Projectile, "id">) => void;
  remove: (id: string) => void;
}

let counter = 0;

export const useProjectiles = create<ProjectileState>((set) => ({
  projectiles: [],
  spawn: (p) =>
    set((s) => ({
      projectiles: [...s.projectiles, { ...p, id: `proj-${(counter += 1)}` }],
    })),
  remove: (id) =>
    set((s) => ({ projectiles: s.projectiles.filter((p) => p.id !== id) })),
}));

// Duração do voo do projétil: 700ms (−30% em relação ao 1s inicial).
export const PROJECTILE_DURATION = 300;

// Dispara um projétil de uma carta (DOM) até a badge do lado alvo.
export function launchProjectile(cardEl: HTMLElement, targetSide: Side) {
  const badge = document.querySelector<HTMLElement>(
    targetSide === "opponent"
      ? ".board-owner-badge:not(.board-player-badge)"
      : ".board-player-badge",
  );
  if (!badge) return;
  const c = cardEl.getBoundingClientRect();
  const b = badge.getBoundingClientRect();
  useProjectiles.getState().spawn({
    x0: c.left + c.width / 3,
    y0: c.top + c.height / 2,
    x1: b.left + b.width / 2,
    y1: b.top + b.height / 3,
    targetSide,
    duration: PROJECTILE_DURATION,
  });
}
