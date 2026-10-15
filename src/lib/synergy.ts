// Sinergia por adjacência. Uma carta com `synergy` buffa a(s) carta(s) vizinha(s)
// no tabuleiro (esquerda/direita), se a posição existir e a condição bater.
// Ex.: synergy.dir "right" no slot 4 não faz nada (não há vizinho à direita).

import type { CardInstance } from "./types";
import type { SynergyRequires } from "./types";

export interface SlotBonus {
  bonusValue: number;
  cooldownMult: number;
}

export interface SynergyLink {
  from: number;
  to: number;
}

export interface SynergyResult {
  bonuses: SlotBonus[]; // por slot (0..3)
  links: SynergyLink[]; // pares fonte -> alvo ativos (para desenhar linhas)
}

function matches(card: CardInstance, req?: SynergyRequires): boolean {
  if (!req) return true;
  const { def } = card;
  if (req === "creature" || req === "spell" || req === "equipment") return def.kind === req;
  const effect = def.effectType ?? (def.damage !== undefined ? "damage" : undefined);
  return effect === req;
}

type Board = (CardInstance | null)[];

export function computeSynergy(board: Board): SynergyResult {
  const bonuses: SlotBonus[] = board.map(() => ({ bonusValue: 0, cooldownMult: 1 }));
  const links: SynergyLink[] = [];

  board.forEach((card, i) => {
    const syn = card?.def.synergy;
    if (!card || !syn) return;
    const targets: number[] = [];
    if (syn.dir === "left" || syn.dir === "both") targets.push(i - 1);
    if (syn.dir === "right" || syn.dir === "both") targets.push(i + 1);
    for (const t of targets) {
      if (t < 0 || t >= board.length) continue; // posição inexistente (ex.: slot 4 à direita)
      const neighbor = board[t];
      if (!neighbor || !matches(neighbor, syn.requires)) continue;
      bonuses[t].bonusValue += syn.bonusValue ?? 0;
      if (syn.cooldownMult !== undefined) bonuses[t].cooldownMult *= syn.cooldownMult;
      links.push({ from: i, to: t });
    }
  });

  return { bonuses, links };
}

export const NO_BONUS: SlotBonus = { bonusValue: 0, cooldownMult: 1 };
