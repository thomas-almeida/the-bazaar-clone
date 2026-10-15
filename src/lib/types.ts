// Tipos compartilhados entre o cliente e o backend de cartas (route handler).
// Portados fielmente das definições de `src/boargame/board.js`.

export type CardKind = "creature" | "spell" | "equipment";
export type EffectType = "damage" | "healing" | "shield";
// Fases do loop: loja, roleta (slot de cassino), bot e player (rival local).
export type Phase = "market" | "roulette" | "bot" | "player";
export type Side = "player" | "opponent";
// Categorias de loja / especialidade de mago.
export type ShopCategory = "dano" | "cura" | "aceleracao" | "escudo";

// Arte de uma carta (imagem ou vídeo em loop, mudo).
export interface Art {
  kind: "image" | "video";
  src: string;
  poster?: string;
}

// Alvo da haste de um equipamento: acelera o próprio lado ("self") ou
// desacelera o lado adversário ("enemy").
export type HasteTarget = "self" | "enemy";

// Condição opcional sobre a carta vizinha para a sinergia valer.
export type SynergyRequires =
  | "creature"
  | "spell"
  | "equipment"
  | "damage"
  | "healing"
  | "shield";

// Sinergia por adjacência: buffa a carta vizinha (esquerda/direita/ambas).
export interface Synergy {
  dir: "left" | "right" | "both";
  requires?: SynergyRequires; // só buffa vizinho que satisfaz a condição
  bonusValue?: number; // +atk/cura/escudo plano no vizinho
  cooldownMult?: number; // multiplica o cooldown do vizinho (ex.: 0.7 = -30%)
  label: string; // descrição legível da sinergia
}

export interface CardDef {
  /** Identificador estável da carta; não muda ao renomear. */
  id: string;
  name: string;
  kind: CardKind;
  /** Cartas arquivadas ficam fora da loja, mas preservadas para decks existentes. */
  enabled?: boolean;
  /** Arte fixa opcional; sem ela, o jogo mantém a seleção atual de arte. */
  art?: Art;
  level?: number;
  cost: number;
  cooldown: number; // segundos (não usado por equipamentos)
  damage?: number;
  effectType?: EffectType;
  effectValue?: number;
  description: string;
  // Campos de equipamento (kind === "equipment"):
  target?: HasteTarget;
  valueHaste?: number; // acréscimo à taxa de crescimento de atk/heal/shield por segundo
  cooldownHaste?: number; // acréscimo à taxa de redução de cooldown por segundo
  // Sinergia por adjacência (qualquer tipo de carta pode ter):
  synergy?: Synergy;
}

export interface OpponentBuild {
  name: string;
  portrait: string;
  background: string;
  deck: string[]; // IDs estáveis de cartas do shopDeck
}

export interface CatalogConfig {
  maxHandSize: number;
  shopTestPrice: number;
  infiniteMana: boolean;
  maxHealth: number;
  maxMana: number;
}

// Contrato do backend de cartas: GET /api/catalog
export interface CatalogResponse {
  version: string;
  config: CatalogConfig;
  cards: CardDef[];
  farmBots: OpponentBuild[];
  rivalBuilds: OpponentBuild[];
}

// Instância de carta em jogo (na mão, no tabuleiro ou numa oferta).
// O tier (0..5) define cor e escala de atributos; `art` é a imagem/vídeo.
export interface CardInstance {
  id: string;
  def: CardDef;
  tier: number;
  art: Art;
}

// Coringa de nível: aplicado fora de batalha para elevar uma carta até seu tier.
export interface Joker {
  id: string;
  tier: number;
}
