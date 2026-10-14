import type { CardDef, Elem } from '../types';

// Criaturas (§8 do GDD)
export const CREATURES: CardDef[] = [
  { id: 'water_weak', name: 'Mob Água Fraco', kind: 'creature', elem: 'water', cost: 1, atk: 1, def: 1, shotDamage: 1, cooldown: 4, tier: 'weak' },
  { id: 'fire_weak', name: 'Mob Fogo Fraco', kind: 'creature', elem: 'fire', cost: 2, atk: 1, def: 1, shotDamage: 2, cooldown: 3, tier: 'weak' },
  { id: 'grass_weak', name: 'Mob Grama Fraco', kind: 'creature', elem: 'grass', cost: 2, atk: 1, def: 1, shotDamage: 3, cooldown: 3, tier: 'weak' },
  { id: 'water_mid', name: 'Mob Água Médio', kind: 'creature', elem: 'water', cost: 3, atk: 3, def: 1, shotDamage: 3, cooldown: 5, tier: 'medium' },
  { id: 'fire_mid', name: 'Mob Fogo Médio', kind: 'creature', elem: 'fire', cost: 4, atk: 4, def: 1, shotDamage: 4, cooldown: 3, tier: 'medium' },
  { id: 'grass_mid', name: 'Mob Grama Médio', kind: 'creature', elem: 'grass', cost: 2, atk: 3, def: 1, shotDamage: 3, cooldown: 1, tier: 'medium' },
  { id: 'water_strong', name: 'Mob Água Forte', kind: 'creature', elem: 'water', cost: 6, atk: 6, def: 1, shotDamage: 6, cooldown: 8, tier: 'strong' },
  { id: 'fire_strong', name: 'Mob Fogo Forte', kind: 'creature', elem: 'fire', cost: 4, atk: 7, def: 1, shotDamage: 7, cooldown: 10, tier: 'strong' },
  { id: 'grass_strong', name: 'Mob Grama Forte', kind: 'creature', elem: 'grass', cost: 4, atk: 5, def: 1, shotDamage: 5, cooldown: 4, tier: 'strong' },
];

// Construções (§8) — uma versão por elemento (visual), mesmo efeito
export const BUILDINGS: CardDef[] = [
  { id: 'wall', name: 'Muralha', kind: 'building', elem: 'water', cost: 2, def: 2, text: 'Mobs adjacentes ganham +2 DEF', tier: 'weak' },
  { id: 'depot', name: 'Depósito', kind: 'building', elem: 'grass', cost: 2, text: '+2 de mana por rolagem de dado', tier: 'medium' },
  { id: 'altar', name: 'Altar', kind: 'building', elem: 'fire', cost: 4, text: 'Cura metade do dano feito no farm', tier: 'strong' },
];

// Terrenos (§8) — custo 0
export const TERRAINS: CardDef[] = [
  { id: 'terrain_fire', name: 'Terreno de Fogo', kind: 'terrain', elem: 'fire', cost: 0 },
  { id: 'terrain_water', name: 'Terreno de Água', kind: 'terrain', elem: 'water', cost: 0 },
  { id: 'terrain_grass', name: 'Terreno de Grama', kind: 'terrain', elem: 'grass', cost: 0 },
];

// Itens de loja (§5 + proposta aprovada) — universais, custo 0, bônus por elemento
export const ITEMS: CardDef[] = [
  { id: 'blade', name: 'Lâmina', kind: 'item', elem: 'fire', cost: 0, atk: 1, text: '+1 ATK na unidade (Fogo: +2)' },
  { id: 'shield', name: 'Escudo', kind: 'item', elem: 'water', cost: 0, def: 3, text: 'Jogador recebe escudo de 3 (Água: 5)' },
  { id: 'totem', name: 'Totem', kind: 'item', elem: 'grass', cost: 0, text: 'Reduz cooldown (Grama: +cura 1/tiro)' },
];

export const ALL_CARDS: CardDef[] = [...CREATURES, ...BUILDINGS, ...TERRAINS, ...ITEMS];

export function cardById(id: string): CardDef | undefined {
  return ALL_CARDS.find((c) => c.id === id);
}

/** Deck inicial de um personagem (§3): mob fraco/médio/forte do elemento,
 *  terreno do elemento, e 3 construções. */
export function startingDeck(elem: Elem): CardDef[] {
  const mobs = CREATURES.filter((c) => c.elem === elem);
  const terrain = TERRAINS.find((t) => t.elem === elem)!;
  return [...mobs, terrain, ...BUILDINGS];
}

/** Pool da loja do personagem: cartas do próprio elemento + itens universais. */
export function shopPool(elem: Elem): CardDef[] {
  const mobs = CREATURES.filter((c) => c.elem === elem);
  const terrain = TERRAINS.find((t) => t.elem === elem)!;
  return [...mobs, terrain, ...BUILDINGS, ...ITEMS];
}
