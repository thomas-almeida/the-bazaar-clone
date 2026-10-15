"use client";

// Store do jogo. Loop em sequência fixa (3 voltas). A fase de loja é um hub de
// vendedores (lojas por categoria); roleta de 3 cartas; merge por tier;
// coringas; cura antes de cada luta. Combate/animações em useCombatEngine.

import { create } from "zustand";
import { artFor, nextId, randomVideoSrc, shuffle } from "./arts";
import { SHOP_ORDER, categoryOf } from "./catalog";
import { buildMageDeck, type Mage } from "./mages";
import { MAX_TIER, randomRouletteTier } from "./tiers";
import type {
  CardDef,
  CardInstance,
  CatalogConfig,
  EffectType,
  Joker,
  OpponentBuild,
  Phase,
  ShopCategory,
  Side,
} from "./types";

export type { ShopCategory } from "./types";

const PHASE_UNIT: Phase[] = [
  "market",
  "roulette",
  "bot",
  "market",
  "roulette",
  "bot",
  "roulette",
  "market",
  "player",
];
const PASSES = 3;
const PHASES: Phase[] = Array.from({ length: PASSES }, () => PHASE_UNIT).flat();

export interface Shop {
  category: ShopCategory;
  items: CardInstance[];
}

interface OpponentState {
  build: OpponentBuild;
  cards: (CardInstance | null)[];
  isPlayer: boolean;
}

interface RouletteState {
  spun: boolean;
  spinning: boolean;
  cards: CardInstance[];
  picked: boolean;
}

export interface EffectResolution {
  actualEffect: EffectType;
  actualValue: number;
  targetSide: Side;
}

interface GameState {
  loaded: boolean;
  config: CatalogConfig;
  deck: CardDef[];
  mage: Mage | null;
  farmBots: OpponentBuild[];
  rivalBuilds: OpponentBuild[];

  phaseIndex: number;
  phase: Phase;
  mana: number;
  hasRolledThisMarket: boolean;

  hand: CardInstance[];
  slots: (CardInstance | null)[];
  shops: Shop[];
  shopView: number | null; // null = hub de vendedores; índice = dentro da loja
  opponent: OpponentState | null;
  roulette: RouletteState;

  playerHealth: number;
  opponentHealth: number;
  playerShield: number;
  opponentShield: number;
  opponentHealthVisible: boolean;

  battleActive: boolean;
  battleWinner: Side | null;
  battleResultOpen: boolean;
  battleOpponentName: string | null;
  runComplete: boolean;
  victories: number;

  jokers: Joker[];
  armedJokerId: string | null;
  mergePrompt: { sourceId: string; targetId: string } | null;

  modalCard: CardInstance | null;

  init: (c: {
    config: CatalogConfig;
    cards: CardDef[];
    farmBots: OpponentBuild[];
    rivalBuilds: OpponentBuild[];
    mage: Mage;
  }) => void;
  rollDie: (face: number) => void;
  openShop: (index: number) => void;
  closeShop: () => void;
  buyOffer: (id: string) => void;
  summon: (cardId: string, slotIndex: number) => void;
  returnToHand: (cardId: string) => void;
  advancePhase: () => void;
  continueAfterWin: () => void;
  restartRun: () => void;
  spinRoulette: () => void;
  pickRoulette: (id: string) => void;
  requestMerge: (sourceId: string, targetId: string) => void;
  confirmMerge: () => void;
  cancelMerge: () => void;
  armJoker: (id: string | null) => void;
  applyJoker: (cardId: string) => void;
  openModal: (card: CardInstance) => void;
  closeModal: () => void;
  resolveBattleEffect: (
    side: Side,
    effectType: EffectType,
    value: number,
  ) => EffectResolution | null;
  fogDamage: (amount: number) => { player: number; opponent: number } | null;

  canAdvance: () => boolean;
  passNumber: () => number;
  isCombat: () => boolean;
}

const DEFAULT_CONFIG: CatalogConfig = {
  maxHandSize: 999,
  shopTestPrice: 1,
  infiniteMana: true,
  maxHealth: 20,
  maxMana: 10,
};

const EMPTY_ROULETTE: RouletteState = { spun: false, spinning: false, cards: [], picked: false };
const ROULETTE_CARDS = 3;

function makeCard(def: CardDef, tier = 0, video?: string): CardInstance {
  return { id: nextId(def.kind), def, tier, art: artFor(def, video) };
}

// Monta as 4 lojas do bazar, cada uma com 2–3 itens da sua categoria.
function buildShops(deck: CardDef[], video?: string): Shop[] {
  return SHOP_ORDER.map((category) => {
    const pool = deck.filter((d) => d.enabled !== false && categoryOf(d) === category);
    const count = Math.min(3, Math.max(2, pool.length));
    const items = shuffle(pool).slice(0, count).map((def) => makeCard(def, 0, video));
    return { category, items };
  }).filter((shop) => shop.items.length > 0);
}

function buildOpponent(build: OpponentBuild, deck: CardDef[], tier: number, isPlayer: boolean): OpponentState {
  const video = randomVideoSrc(); // oponente usa um vídeo próprio nos feitiços
  const cards: (CardInstance | null)[] = [];
  build.deck.forEach((cardId) => {
    const def = deck.find((d) => d.id === cardId);
    if (!def) throw new Error(`Deck do oponente referencia carta desconhecida "${cardId}".`);
    cards.push(makeCard(def, tier, video));
  });
  while (cards.length < 4) cards.push(null);
  return { build, cards, isPlayer };
}

function findCard(state: GameState, id: string): CardInstance | null {
  return state.hand.find((c) => c.id === id) ?? state.slots.find((c) => c?.id === id) ?? null;
}

export const useGame = create<GameState>((set, get) => ({
  loaded: false,
  config: DEFAULT_CONFIG,
  deck: [],
  mage: null,
  farmBots: [],
  rivalBuilds: [],

  phaseIndex: 0,
  phase: "market",
  mana: 0,
  hasRolledThisMarket: false,

  hand: [], // começa sem cartas
  slots: [null, null, null, null],
  shops: [],
  shopView: null,
  opponent: null,
  roulette: EMPTY_ROULETTE,

  playerHealth: DEFAULT_CONFIG.maxHealth,
  opponentHealth: DEFAULT_CONFIG.maxHealth,
  playerShield: 0,
  opponentShield: 0,
  opponentHealthVisible: false,

  battleActive: false,
  battleWinner: null,
  battleResultOpen: false,
  battleOpponentName: null,
  runComplete: false,
  victories: 0,

  jokers: [],
  armedJokerId: null,
  mergePrompt: null,

  modalCard: null,

  init: ({ config, cards, farmBots, rivalBuilds, mage }) => {
    set({
      loaded: true,
      config: { ...config, maxHandSize: 999 },
      deck: buildMageDeck(mage, cards),
      mage,
      farmBots,
      rivalBuilds,
      hand: [],
      slots: [null, null, null, null],
      playerHealth: config.maxHealth,
      playerShield: 0,
      mana: 0,
      jokers: [],
      victories: 0,
      runComplete: false,
    });
    enterPhase(0, set, get);
  },

  rollDie: (face) => {
    const { phase, hasRolledThisMarket, config, mana } = get();
    if (phase !== "market" || hasRolledThisMarket) return;
    const nextMana = config.infiniteMana ? mana : Math.min(config.maxMana, mana + face);
    set({ hasRolledThisMarket: true, mana: nextMana });
  },

  openShop: (index) => {
    const s = get();
    if (s.phase !== "market" || index < 0 || index >= s.shops.length) return;
    set({ shopView: index, armedJokerId: null });
  },
  closeShop: () => set({ shopView: null }),

  buyOffer: (id) => {
    const { phase, shops, hand } = get();
    if (phase !== "market") return;
    let bought: CardInstance | null = null;
    const nextShops = shops.map((shop) => {
      if (bought) return shop;
      const item = shop.items.find((i) => i.id === id);
      if (!item) return shop;
      bought = item;
      return { ...shop, items: shop.items.filter((i) => i.id !== id) };
    });
    if (!bought) return;
    set({ shops: nextShops, hand: [...hand, makeCard((bought as CardInstance).def, 0, get().mage?.video)] });
  },

  summon: (cardId, slotIndex) => {
    const { hand, slots } = get();
    if (get().isCombat()) return;
    if (slotIndex < 0 || slotIndex > 3 || slots[slotIndex]) return;
    const card = hand.find((c) => c.id === cardId);
    if (!card) return;
    const nextSlots = [...slots];
    nextSlots[slotIndex] = card;
    set({ hand: hand.filter((c) => c.id !== cardId), slots: nextSlots });
  },

  returnToHand: (cardId) => {
    const s = get();
    if (s.isCombat()) return;
    const idx = s.slots.findIndex((c) => c?.id === cardId);
    if (idx < 0) return;
    const card = s.slots[idx]!;
    const nextSlots = [...s.slots];
    nextSlots[idx] = null;
    set({ slots: nextSlots, hand: [...s.hand, card] });
  },

  advancePhase: () => {
    const s = get();
    if (s.phase === "market") {
      if (s.battleActive || !s.hasRolledThisMarket) return;
    } else if (s.phase === "roulette") {
      if (!s.roulette.spun) return; // pode avançar sem escolher carta
    } else {
      return;
    }
    enterPhase(s.phaseIndex + 1, set, get);
  },

  continueAfterWin: () => {
    const s = get();
    if (s.battleWinner !== "player") {
      get().restartRun();
      return;
    }
    const victories = s.victories + 1;
    const jokerTier = Math.min(MAX_TIER, Math.ceil(victories / 2));
    const jokers = addJoker(s.jokers, { id: nextId("joker"), tier: jokerTier });
    set({ victories, jokers, battleResultOpen: false });

    if (s.phaseIndex + 1 >= PHASES.length) {
      set({ runComplete: true, battleActive: false });
      return;
    }
    enterPhase(s.phaseIndex + 1, set, get);
  },

  restartRun: () => {
    const { config } = get();
    set({
      hand: [],
      slots: [null, null, null, null],
      playerHealth: config.maxHealth,
      playerShield: 0,
      opponentShield: 0,
      mana: 0,
      opponent: null,
      battleActive: false,
      battleWinner: null,
      battleResultOpen: false,
      battleOpponentName: null,
      runComplete: false,
      victories: 0,
      jokers: [],
      armedJokerId: null,
      mergePrompt: null,
      modalCard: null,
    });
    enterPhase(0, set, get);
  },

  spinRoulette: () => {
    const s = get();
    if (s.phase !== "roulette" || s.roulette.spun) return;
    const video = s.mage?.video;
    const available = s.deck.filter((card) => card.enabled !== false);
    if (available.length === 0) return;
    const fallback = available[0];
    if (!fallback) return;
    const cards = Array.from({ length: ROULETTE_CARDS }, () => {
      const def = available[Math.floor(Math.random() * available.length)];
      return makeCard(def ?? fallback, randomRouletteTier(), video);
    });
    set({ roulette: { spun: true, spinning: true, cards, picked: false } });
    window.setTimeout(() => {
      const r = get().roulette;
      if (r.spun) set({ roulette: { ...r, spinning: false } });
    }, 1500);
  },

  pickRoulette: (id) => {
    const s = get();
    const r = s.roulette;
    if (!r.spun || r.spinning || r.picked) return;
    const card = r.cards.find((c) => c.id === id);
    if (!card) return;
    set({ hand: [...s.hand, makeCard(card.def, card.tier, s.mage?.video)], roulette: { ...r, picked: true } });
  },

  requestMerge: (sourceId, targetId) => {
    if (sourceId === targetId) return;
    set({ mergePrompt: { sourceId, targetId }, armedJokerId: null });
  },

  confirmMerge: () => {
    const s = get();
    if (!s.mergePrompt) return;
    const { sourceId, targetId } = s.mergePrompt;
    const target = findCard(s, targetId);
    if (!target) {
      set({ mergePrompt: null });
      return;
    }
    const newTier = Math.min(MAX_TIER, target.tier + 1);
    const bump = (c: CardInstance | null) => (c && c.id === targetId ? { ...c, tier: newTier } : c);
    set({
      hand: s.hand.filter((c) => c.id !== sourceId).map((c) => bump(c) as CardInstance),
      slots: s.slots.map(bump),
      mergePrompt: null,
    });
  },

  cancelMerge: () => set({ mergePrompt: null }),

  armJoker: (id) => set((s) => ({ armedJokerId: s.armedJokerId === id ? null : id })),

  applyJoker: (cardId) => {
    const s = get();
    if (s.isCombat() || !s.armedJokerId) return;
    const joker = s.jokers.find((j) => j.id === s.armedJokerId);
    const card = findCard(s, cardId);
    if (!joker || !card) return;
    const newTier = Math.max(card.tier, joker.tier);
    const bump = (c: CardInstance | null) => (c && c.id === cardId ? { ...c, tier: newTier } : c);
    set({
      hand: s.hand.map((c) => bump(c) as CardInstance),
      slots: s.slots.map(bump),
      jokers: s.jokers.filter((j) => j.id !== joker.id),
      armedJokerId: null,
    });
  },

  openModal: (card) => set({ modalCard: card }),
  closeModal: () => set({ modalCard: null }),

  resolveBattleEffect: (side, effectType, value) => {
    const s = get();
    if (!s.battleActive || !Number.isFinite(value) || value < 0) return null;
    const isPlayer = side === "player";
    let actualEffect: EffectType = effectType;
    let actualValue = value;
    let targetSide: Side;
    let { playerHealth, opponentHealth, playerShield, opponentShield } = s;
    const maxH = s.config.maxHealth;

    if (effectType === "damage") {
      const targetIsPlayer = !isPlayer;
      targetSide = targetIsPlayer ? "player" : "opponent";
      const targetShield = targetIsPlayer ? playerShield : opponentShield;
      const previousHealth = targetIsPlayer ? playerHealth : opponentHealth;
      let remaining = value;
      const absorbed = Math.min(targetShield, remaining);
      remaining -= absorbed;
      const healthDamage = Math.min(previousHealth, remaining);
      actualValue = healthDamage > 0 ? healthDamage : absorbed;
      actualEffect = healthDamage > 0 ? "damage" : "shield";
      if (targetIsPlayer) {
        playerShield = targetShield - absorbed;
        playerHealth = Math.max(0, playerHealth - remaining);
      } else {
        opponentShield = targetShield - absorbed;
        opponentHealth = Math.max(0, opponentHealth - remaining);
      }
    } else if (effectType === "healing") {
      targetSide = side;
      const previousHealth = isPlayer ? playerHealth : opponentHealth;
      if (isPlayer) playerHealth = Math.min(maxH, playerHealth + value);
      else opponentHealth = Math.min(maxH, opponentHealth + value);
      actualValue = (isPlayer ? playerHealth : opponentHealth) - previousHealth;
    } else {
      targetSide = side;
      if (isPlayer) playerShield += value;
      else opponentShield += value;
    }

    const affectedPlayer = effectType === "damage" ? !isPlayer : isPlayer;
    const resultingHealth = affectedPlayer ? playerHealth : opponentHealth;
    set({ playerHealth, opponentHealth, playerShield, opponentShield });

    if (resultingHealth <= 0) {
      const winner: Side = isPlayer ? "player" : "opponent";
      set({ battleActive: false, battleWinner: winner, battleResultOpen: true });
    }
    return { actualEffect, actualValue, targetSide };
  },

  fogDamage: (amount) => {
    const s = get();
    if (!s.battleActive) return null;
    const playerApplied = Math.min(s.playerHealth, amount);
    const opponentApplied = Math.min(s.opponentHealth, amount);
    const playerHealth = Math.max(0, s.playerHealth - amount);
    const opponentHealth = Math.max(0, s.opponentHealth - amount);
    set({ playerHealth, opponentHealth });
    if (playerHealth <= 0 || opponentHealth <= 0) {
      const winner: Side = playerHealth <= 0 ? "opponent" : "player";
      set({ battleActive: false, battleWinner: winner, battleResultOpen: true });
    }
    return { player: playerApplied, opponent: opponentApplied };
  },

  canAdvance: () => {
    const s = get();
    if (s.battleActive) return false;
    if (s.phase === "market") return s.hasRolledThisMarket;
    if (s.phase === "roulette") return s.roulette.spun;
    return false;
  },
  passNumber: () => Math.floor(get().phaseIndex / PHASE_UNIT.length) + 1,
  isCombat: () => {
    const p = get().phase;
    return p === "bot" || p === "player";
  },
}));

function addJoker(jokers: Joker[], joker: Joker): Joker[] {
  const next = [...jokers, joker];
  if (next.length <= 3) return next;
  next.sort((a, b) => b.tier - a.tier);
  return next.slice(0, 3);
}

function enterPhase(
  index: number,
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
) {
  if (index >= PHASES.length) {
    set({ runComplete: true, battleActive: false });
    return;
  }
  const phase = PHASES[index];
  const pass = Math.floor(index / PHASE_UNIT.length);
  const common: Partial<GameState> = {
    phaseIndex: index,
    phase,
    battleResultOpen: false,
    battleWinner: null,
    armedJokerId: null,
    mergePrompt: null,
  };

  if (phase === "market") {
    set({
      ...common,
      hasRolledThisMarket: false,
      battleActive: false,
      opponentHealthVisible: false,
      opponent: null,
      shops: buildShops(get().deck, get().mage?.video),
      shopView: null,
      roulette: EMPTY_ROULETTE,
    });
    return;
  }

  if (phase === "roulette") {
    set({
      ...common,
      battleActive: false,
      opponentHealthVisible: false,
      opponent: null,
      shops: [],
      shopView: null,
      roulette: { ...EMPTY_ROULETTE },
    });
    return;
  }

  const { deck, config } = get();
  const pool = phase === "bot" ? get().farmBots : get().rivalBuilds;
  const build = pool[Math.floor(Math.random() * pool.length)];
  const opponent = buildOpponent(build, deck, Math.min(MAX_TIER, pass), phase === "player");
  set({
    ...common,
    shops: [],
    shopView: null,
    roulette: EMPTY_ROULETTE,
    opponent,
    playerHealth: config.maxHealth,
    playerShield: 0,
    opponentHealth: config.maxHealth,
    opponentShield: 0,
    opponentHealthVisible: true,
    battleActive: true,
    battleOpponentName: build.name,
  });
}
