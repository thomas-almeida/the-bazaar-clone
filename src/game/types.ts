// Tipos centrais do jogo. Lógica pura — sem React, sem Three.

export type Elem = 'fire' | 'water' | 'grass';

export type CardKind = 'creature' | 'spell' | 'building' | 'terrain' | 'item';

export type Phase = 'menu' | 'dice' | 'shop' | 'farm' | 'battle' | 'result' | 'gameover';

/** Definição estática de uma carta (vem do catálogo). */
export interface CardDef {
  id: string;
  name: string;
  kind: CardKind;
  elem: Elem;
  cost: number; // custo em mana (terrenos e itens = 0)
  // Criaturas:
  atk?: number;
  def?: number;
  shotDamage?: number; // dano por tiro
  cooldown?: number; // segundos entre tiros
  // Texto de efeito (construções/itens):
  text?: string;
  tier?: 'weak' | 'medium' | 'strong';
}

/** Instância de carta na mão (cópia jogável com id único). */
export interface CardInstance {
  uid: string;
  def: CardDef;
}

/** Item equipado numa unidade/terreno. */
export interface EquippedItem {
  defId: string;
}

/** Estado de uma casa do tabuleiro. */
export interface BoardCell {
  index: number; // 0..5 (3 colunas x 2 linhas por lado)
  row: 'front' | 'back';
  col: number; // 0..2
  terrain: Elem | null; // elemento pintado
  terrainStack: number; // 0..2 camadas (bônus se >=2 iguais)
  // Ocupante (criatura OU construção):
  occupant: CardDef | null;
  items: EquippedItem[];
  // Estado de combate (runtime):
  currentHP?: number;
  cooldownRemaining?: number;
}

/** Mob de jungle na fase de farm. */
export interface JungleMob {
  elem: Elem;
  hp: number;
  index: number;
}

/** Snapshot de um bot adversário (build congelada). */
export interface Snapshot {
  id: string;
  character: Elem;
  hp: number;
  board: BoardCell[];
}

export interface RunState {
  character: Elem;
  playerHP: number;
  mana: number;
  round: number;
  wins: number;
  phase: Phase;
  hand: CardInstance[];
  board: BoardCell[];
  shopOffers: CardInstance[];
  snapshots: Snapshot[];
  lastDice: number | null;
  log: string[];
}
