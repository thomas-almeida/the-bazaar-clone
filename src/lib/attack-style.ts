"use client";

// Estilo visual do ataque de uma carta. Deriva do mesmo campo que define o som
// (`def.sound`) e, na falta dele, do efeito/categoria — igual a
// `legacyCardSoundId`, para que som e animação combinem.
//
// Movimentos:
//  - "shot": projétil reto e rápido (pistola/tiro).
//  - "arc":  projétil mágico que descreve uma curva até a badge (blast).
//  - "melee": sem trajetória — o corte/golpe surge direto na badge alvo.

import { categoryOf } from "./catalog";
import type { CardDef, CardSound } from "./types";

export type AttackStyle = CardSound; // sword | pistol | blast | heal | shield | haste
export type AttackMotion = "shot" | "arc" | "melee";

/** Estilo da carta, priorizando o campo explícito `sound`. */
export function attackStyle(def: CardDef): AttackStyle {
  if (def.sound) return def.sound;
  if (def.effectType === "healing") return "heal";
  if (def.effectType === "shield") return "shield";
  if (categoryOf(def) === "aceleracao") return "haste";
  return "blast";
}

/** Movimento do projétil de uma carta de DANO a partir do estilo. */
export function attackMotion(style: AttackStyle): AttackMotion {
  if (style === "sword") return "melee";
  if (style === "pistol") return "shot";
  return "arc"; // blast e quaisquer outros caem no projétil mágico em curva
}
