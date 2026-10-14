import type { Elem, Snapshot, BoardCell, CardDef } from './types';
import { CREATURES } from './data/cards';
import { createEmptyBoard } from './board';
import { BOT_RECIPES, BOT_HP } from './data/constants';

let counter = 0;
const uid = () => `bot_${Date.now()}_${counter++}`;

/**
 * Gera o snapshot de um bot (§9). A força é escalonada por `difficulty`
 * (0 = 1º oponente, 1 = 2º, 2+ = 3º) usando receitas fixas de tiers em
 * BOT_RECIPES (constants.ts): quantidade e tier das criaturas crescem a cada rodada.
 */
export function generateSnapshot(difficulty: number, elem?: Elem): Snapshot {
  const elems: Elem[] = ['fire', 'water', 'grass'];
  const character = elem ?? elems[Math.floor(Math.random() * elems.length)];
  const board: BoardCell[] = createEmptyBoard();

  const d = Math.max(0, Math.min(BOT_RECIPES.length - 1, Math.floor(difficulty)));
  const recipe = BOT_RECIPES[d];
  const slots = [...board].sort(() => Math.random() - 0.5);

  recipe.forEach((tier, i) => {
    const def: CardDef | undefined = CREATURES.find((c) => c.elem === character && c.tier === tier);
    const cell = slots[i];
    if (!def || !cell) return;
    cell.terrain = character;
    cell.terrainStack = 1;
    cell.occupant = def;
  });

  return { id: uid(), character, hp: BOT_HP[d], board };
}

/** Gera os 3 adversários do gameplay loop (§9), em dificuldade crescente. */
export function generateLoopSnapshots(): Snapshot[] {
  return [0, 1, 2].map((d) => generateSnapshot(d));
}
