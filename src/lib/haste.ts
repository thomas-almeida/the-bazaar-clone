// Mecânica de haste / aceleração.
//
// Durante o combate, o tempo escala o efeito das cartas: quanto mais a batalha
// dura, maior o atk/heal/shield. Equipamentos ajustam as *taxas* por lado —
// "self" acelera o próprio lado (mais valor e/ou menos cooldown), "enemy"
// desacelera o lado adversário.
//
// Para um lado, no instante t (segundos de combate):
//   valueScale = 1 + valueRate * t   -> multiplica atk/heal/shield
//   cdScale    = 1 + cdRate   * t   -> divide o cooldown
// onde as taxas = base + equipamentos próprios (self) − equipamentos inimigos (enemy).

import type { CardInstance } from "./types";

// Taxa-base: todo mundo acelera o valor com o tempo (+6%/s). Cooldown só encurta
// via equipamento (base 0), conforme "o haste pode dar mais dano ou menor cooldown".
export const BASE_VALUE_HASTE = 0.06;
export const BASE_CD_HASTE = 0;
export const MIN_COOLDOWN_MS = 500;

export interface Rates {
  value: number;
  cd: number;
}

type Board = (CardInstance | null)[];

export function sideRates(selfBoard: Board, enemyBoard: Board): Rates {
  let value = BASE_VALUE_HASTE;
  let cd = BASE_CD_HASTE;
  for (const c of selfBoard) {
    if (c?.def.kind === "equipment" && c.def.target === "self") {
      value += c.def.valueHaste ?? 0;
      cd += c.def.cooldownHaste ?? 0;
    }
  }
  for (const c of enemyBoard) {
    if (c?.def.kind === "equipment" && c.def.target === "enemy") {
      value -= c.def.valueHaste ?? 0;
      cd -= c.def.cooldownHaste ?? 0;
    }
  }
  return { value: Math.max(0, value), cd: Math.max(0, cd) };
}

export function effectiveValue(base: number, rate: number, t: number): number {
  return Math.max(base, Math.round(base * (1 + rate * t)));
}

export function effectiveCooldownMs(baseMs: number, rate: number, t: number): number {
  return Math.max(MIN_COOLDOWN_MS, baseMs / (1 + rate * t));
}

// Formata segundos com 1 casa, sem ".0" (ex.: 4 -> "4", 3.2 -> "3.2").
export function formatSeconds(seconds: number): string {
  const rounded = Math.round(seconds * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
