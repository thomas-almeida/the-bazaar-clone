"use client";

// Store leve de projéteis cosméticos. O motor de combate chama launchProjectile()
// quando uma carta de dano dispara; a camada <ProjectileLayer/> renderiza e
// remove. O dano em si é aplicado no store do jogo no instante do disparo; o
// projétil é apenas visual e dispara o tremor/flash da badge ao impactar.
//
// Cada projétil carrega o ESTILO (pistol/blast/sword...) e o MOVIMENTO:
//  - "shot": reto e rápido;
//  - "arc":  curva (mágico);
//  - "melee": sem trajetória, o golpe surge na própria badge.

import { create } from "zustand";
import { attackStyle, type AttackStyle } from "./attack-style";
import { resolveVfx, useVfxConfig, type VfxConfig, type VfxMotion, type VfxStyle } from "./vfx";
import type { CardDef, Side } from "./types";

export interface Projectile {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  targetSide: Side; // badge que treme/pisca no impacto
  duration: number; // ms
  style: AttackStyle;
  motion: VfxMotion;
  /** Visual resolvido (cor, tamanho, blur...) já "assado" no projétil. */
  vfx: VfxStyle;
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

function badgeFor(targetSide: Side): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    targetSide === "opponent"
      ? ".board-owner-badge:not(.board-player-badge)"
      : ".board-player-badge",
  );
}

/** Pisca a badge do lado em verde brilhante com blur (cura aplicada). */
export function healBadge(side: Side) {
  const badge = badgeFor(side);
  if (!badge) return;
  badge.classList.remove("is-healed");
  void badge.offsetWidth; // reflow para reiniciar a animação
  badge.classList.add("is-healed");
  window.setTimeout(() => badge.classList.remove("is-healed"), 760);
}

// Dispara o projétil/golpe de uma carta (DOM) até a badge do lado alvo,
// escolhendo o visual pela config de VFX (publicada, ou uma passada no preview).
export function launchProjectile(
  cardEl: HTMLElement,
  targetSide: Side,
  def: CardDef,
  config?: VfxConfig,
) {
  const badge = badgeFor(targetSide);
  if (!badge) return;
  const b = badge.getBoundingClientRect();
  const x1 = b.left + b.width / 2;
  const y1 = b.top + b.height / 2;

  const style = attackStyle(def);
  const vfx = resolveVfx(style, config ?? useVfxConfig.getState().config);
  const { motion } = vfx;

  // Melee não viaja: nasce na própria badge.
  if (motion === "melee") {
    useProjectiles.getState().spawn({
      x0: x1, y0: y1, x1, y1, targetSide, duration: vfx.speed, style, motion, vfx,
    });
    return;
  }

  const c = cardEl.getBoundingClientRect();
  useProjectiles.getState().spawn({
    x0: c.left + c.width / 2,
    y0: c.top + c.height / 2,
    x1,
    y1,
    targetSide,
    duration: vfx.speed,
    style,
    motion,
    vfx,
  });
}
