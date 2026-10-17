// Catálogo de cartas, NPCs e rivais — fonte única usada pelo backend (route
// handler em app/api/catalog). Portado de `src/boargame/board.js` (shopDeck,
// farmBots, rivalBuilds) e dos valores de teste ativos descritos no guia.

import type { CardDef, CatalogConfig, OpponentBuild, ShopCategory } from "./types";

export const SHOP_ORDER: ShopCategory[] = ["dano", "cura", "aceleracao", "escudo"];

// Categoria de uma carta (loja / especialidade de mago), derivada do efeito.
export function categoryOf(def: CardDef): ShopCategory {
  if (def.kind === "equipment") return "aceleracao";
  if (def.effectType === "healing") return "cura";
  if (def.effectType === "shield") return "escudo";
  return "dano"; // criaturas + feitiços de dano
}

export const CONFIG: CatalogConfig = {
  maxHandSize: 7,
  shopTestPrice: 1,
  infiniteMana: false,
  maxHealth: 100,
  maxMana: 15,
};

export const SHOP_DECK: CardDef[] = [
  { id: "dragon-whelp", name: "DRAGON WHELP", kind: "creature", level: 1, cost: 4, cooldown: 4, damage: 2, description: "A fierce little dragon ready to join the fight." },
  { id: "phoenix-lord", name: "PHOENIX LORD", kind: "creature", level: 3, cost: 7, cooldown: 5, damage: 4, description: "When destroyed, return to your hand and deal 3 damage to all enemies." },
  { id: "healing-rain", name: "HEALING RAIN", kind: "spell", cost: 3, cooldown: 3, effectType: "healing", effectValue: 4, description: "Restore 4 health to all friendly creatures." },
  { id: "moonlit-mage", name: "MOONLIT MAGE", kind: "creature", level: 2, cost: 5, cooldown: 3, damage: 3, description: "At the start of your turn, deal 1 damage to all enemies." },
  { id: "ember-sprite", name: "EMBER SPRITE", kind: "creature", level: 1, cost: 2, cooldown: 1.5, damage: 1, description: "A quick spark that strikes before the enemy can react." },
  { id: "tide-guardian", name: "TIDE GUARDIAN", kind: "creature", level: 2, cost: 4, cooldown: 4, damage: 2, description: "A steady defender that keeps the frontline safe." },
  { id: "thorn-beast", name: "THORN BEAST", kind: "creature", level: 2, cost: 3, cooldown: 2, damage: 2, description: "A thorny beast with a reliable attack." },
  { id: "starfall", name: "STARFALL", kind: "spell", cost: 2, cooldown: 2, effectType: "damage", effectValue: 3, description: "Deal 3 damage with a focused burst of astral energy." },
  { id: "arcane-barrier", name: "ARCANE BARRIER", kind: "spell", cost: 3, cooldown: 4, effectType: "shield", effectValue: 3, description: "Grant 3 shield to all friendly creatures." },
  // Cura (loja de cura)
  { id: "verdant-bloom", name: "VERDANT BLOOM", kind: "spell", cost: 2, cooldown: 2, effectType: "healing", effectValue: 3, description: "A quick bloom that mends light wounds." },
  { id: "sacred-font", name: "SACRED FONT", kind: "spell", cost: 5, cooldown: 5, effectType: "healing", effectValue: 6, description: "A holy font that restores a large amount of health." },
  // Escudo (loja de escudo)
  { id: "iron-ward", name: "IRON WARD", kind: "spell", cost: 2, cooldown: 2, effectType: "shield", effectValue: 2, description: "A swift ward that raises a small barrier." },
  { id: "aegis-totem", name: "AEGIS TOTEM", kind: "spell", cost: 5, cooldown: 5, effectType: "shield", effectValue: 5, description: "A sturdy totem that grants a heavy shield." },
  // Sinergia por adjacência (buffam a carta vizinha conforme a posição)
  {
    id: "pack-alpha", name: "PACK ALPHA", kind: "creature", level: 2, cost: 4, cooldown: 4, damage: 2,
    description: "Líder de matilha: reforça as criaturas ao seu lado.",
    synergy: { dir: "both", requires: "creature", bonusValue: 2, label: "+2 de dano às criaturas adjacentes" },
  },
  {
    id: "tide-totem", name: "TIDE TOTEM", kind: "equipment", cost: 4, cooldown: 0, target: "self",
    description: "Totem veloz: acelera a carta imediatamente à direita.",
    synergy: { dir: "right", cooldownMult: 0.7, label: "-30% de cooldown na carta à direita" },
  },
  {
    id: "soul-link", name: "SOUL LINK", kind: "spell", cost: 3, cooldown: 3, effectType: "healing", effectValue: 2,
    description: "Elo de alma: potencializa a carta imediatamente à esquerda.",
    synergy: { dir: "left", bonusValue: 2, label: "+2 ao efeito da carta à esquerda" },
  },
  // Equipamentos: alteram as taxas de haste (ver src/lib/haste.ts).
  { id: "time-crystal", name: "TIME CRYSTAL", kind: "equipment", cost: 4, cooldown: 0, target: "self", valueHaste: 0.12, description: "Acelera o crescimento de dano, cura e escudo das suas cartas." },
  { id: "swift-gear", name: "SWIFT GEAR", kind: "equipment", cost: 4, cooldown: 0, target: "self", cooldownHaste: 0.5, description: "Reduz o cooldown das suas cartas progressivamente." },
  { id: "hex-chain", name: "HEX CHAIN", kind: "equipment", cost: 5, cooldown: 0, target: "enemy", valueHaste: 0.09, cooldownHaste: 0.06, description: "Desacelera o haste das cartas do adversário." },
  // Peças: cartas sem dano, só ativam condições de mago. WAKIZASHI habilita e
  // intensifica o sangramento de YAMATO (ver passives.ts / useCombatEngine).
  { id: "wakizashi", name: "WAKIZASHI", kind: "equipment", cost: 3, cooldown: 0, piece: true, bleed: 1, description: "Peça de YAMATO: enquanto estiver no tabuleiro, o oponente sangra — e o sangramento por segundo cresce ao longo da batalha." },
];

export const FARM_BOTS: OpponentBuild[] = [
  { name: "MAGO DAS BRASAS", portrait: "cover-5.jpg", background: "cover-5.jpg", deck: ["ember-sprite", "phoenix-lord", "arcane-barrier"] },
  { name: "ORÁCULO DA MARÉ", portrait: "cover-3.jpg", background: "cover-3.jpg", deck: ["tide-guardian", "healing-rain", "arcane-barrier"] },
  { name: "DRUIDA DO BOSQUE", portrait: "cover-4.jpg", background: "cover-4.jpg", deck: ["thorn-beast", "moonlit-mage", "arcane-barrier"] },
];

export const RIVAL_BUILDS: OpponentBuild[] = [
  { name: "DUELISTA DAS CINZAS", portrait: "cover-5.jpg", background: "cover-5.jpg", deck: ["ember-sprite", "dragon-whelp", "phoenix-lord", "starfall"] },
  { name: "GUARDIÃ DA MARÉ", portrait: "cover-6.jpg", background: "cover-6.jpg", deck: ["tide-guardian", "healing-rain", "moonlit-mage", "arcane-barrier"] },
  { name: "CAMPEÃO DO BOSQUE", portrait: "cover-3.jpg", background: "cover-3.jpg", deck: ["thorn-beast", "moonlit-mage", "phoenix-lord", "healing-rain"] },
];

export const CATALOG_VERSION = "1.0.0";
