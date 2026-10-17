// Passivas exclusivas de cada mago, aplicadas no tabuleiro do jogador.
// Compartilhado entre o motor de combate (efeito real) e a UI (exibição/brilho).
//
// - "slot3"        (dano):   a carta no slot 3 ganha +5% de atributo e -10% cooldown.
// - "heal-adjacent"(cura):   cartas de cura adjacentes multiplicam o efeito por 1.2.
// - "shield-maxhp" (escudo): com 2+ itens de escudo na MÃO, a vida máxima dobra.

import type { Mage, MagePassive } from "./mages";
import { tierValue } from "./tiers";
import type { CardInstance } from "./types";

export interface PassiveMods {
  valueMult: number;
  cdMult: number;
  active: boolean;
}

const NONE: PassiveMods = { valueMult: 1, cdMult: 1, active: false };

function effectOf(card: CardInstance | null | undefined): string | undefined {
  if (!card) return undefined;
  return card.def.effectType ?? (card.def.damage !== undefined ? "damage" : undefined);
}

// Modificadores que a passiva do mago aplica à carta do jogador no slot `index`.
export function playerPassiveMods(
  slots: (CardInstance | null)[],
  mage: Mage | null,
  index: number,
): PassiveMods {
  const card = slots[index];
  if (!card || !mage) return NONE;
  const passive: MagePassive = mage.passive;

  if (passive === "slot3" && index === 2) {
    return { valueMult: 1.05, cdMult: 0.9, active: true };
  }
  if (passive === "heal-adjacent" && effectOf(card) === "healing") {
    const near = effectOf(slots[index - 1]) === "healing" || effectOf(slots[index + 1]) === "healing";
    if (near) return { valueMult: 1.2, cdMult: 1, active: true };
  }
  return NONE;
}

/**
 * Passo de sangramento por segundo (estilo névoa) que o mago aplica ao oponente.
 *
 * Vale só para a passiva SANGRIA (YAMATO) e quando há peça(s) de sangramento no
 * tabuleiro (WAKIZASHI). Cada segundo o dano por segundo cresce por este passo,
 * somando a contribuição de cada peça (escalada pelo tier). Zero desliga o
 * sangramento.
 */
export function bleedStepPerSecond(
  slots: (CardInstance | null)[],
  mage: Mage | null,
): number {
  if (!mage || mage.passive !== "bleed-wakizashi") return 0;
  let step = 0;
  for (const card of slots) {
    if (card?.def.piece && card.def.bleed) step += tierValue(card.def.bleed, card.tier);
  }
  return step;
}

export function shieldInHand(hand: CardInstance[]): number {
  return hand.filter((c) => effectOf(c) === "shield").length;
}

export function shieldMaxActive(mage: Mage | null, hand: CardInstance[]): boolean {
  return !!mage && mage.passive === "shield-maxhp" && shieldInHand(hand) >= 2;
}

/**
 * Vida máxima efetiva do jogador.
 *
 * `base` é a vida máxima da run (config + aventura). A passiva MURALHA dobra
 * **só a base** — o ganho de vida máxima conquistado com cura durante a
 * batalha entra por cima, sem ser dobrado, senão uma carta de cura passaria a
 * render o dobro do seu valor em vida máxima.
 */
export function effectiveMaxHealth(
  baseMax: number,
  mage: Mage | null,
  hand: CardInstance[],
  gain = 0,
): number {
  const withPassive = shieldMaxActive(mage, hand) ? baseMax * 2 : baseMax;
  return withPassive + gain;
}
