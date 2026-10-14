import type { Elem } from '../types';

export const PLAYER_START_HP = 100;
export const ENEMY_START_HP = 100;
export const MANA_CAP = Infinity; // sem teto (decisão canônica)
export const SHOP_OFFERS = 3;
export const WINS_TO_COMPLETE_RUN = 3;
export const BATTLE_MAX_SECONDS = 30;

export const SHOTS_PER_CREATURE_FARM = 5;
export const ELEMENTAL_BONUS_CAP = 3; // teto por elemento no farm
export const TERRAIN_STACK_BONUS = 1; // +1/+1 por terreno duplicado

/** Receitas dos bots por dificuldade (índice = vitórias): tiers das criaturas. */
export const BOT_RECIPES: Array<Array<'weak' | 'medium' | 'strong'>> = [
  ['weak', 'weak'], // 1º oponente: fraco
  ['medium', 'weak', 'weak'], // 2º: intermediário
  ['strong', 'medium', 'medium', 'weak'], // 3º: forte
];
/** HP dos bots por dificuldade. */
export const BOT_HP: number[] = [100, 100, 100];

/** Fôlego inicial: bônus de mana somado ao dado por rodada (índice = round-1). */
export const EARLY_MANA_BONUS: number[] = [4, 3, 2, 1];

export const ELEM_COLORS: Record<Elem, string> = {
  fire: '#ff5a3c',
  water: '#3ca5ff',
  grass: '#6fcf5a',
};

export const ELEM_LABEL: Record<Elem, string> = {
  fire: 'Fogo',
  water: 'Água',
  grass: 'Grama',
};
