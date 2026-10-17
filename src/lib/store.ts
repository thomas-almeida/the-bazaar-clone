"use client";

// Store do jogo (3 voltas). Fases: bazar (hub de vendedores), aventura (3
// situações), bot (escolha entre NPCs) e player (modal de versus). O NPC
// escolhido define um "tema" que influencia a loja/aventura dos próximos ciclos.
// Vida máxima pode crescer (aventura). Combate/animações em useCombatEngine.

import { create } from "zustand";
import { artFor, nextId, randomVideoSrc, shuffle } from "./arts";
import { SHOP_ORDER, categoryOf } from "./catalog";
import { buildMageDeck, getMage, type Mage } from "./mages";
import { effectiveMaxHealth } from "./passives";
import { playEvent } from "./sfx";
import { playMageCardPlace, playMageLine, resetMageVoice } from "./mage-voice";
import { fetchOpponentSnapshot } from "./snapshots";
import { MAX_TIER, tierKey } from "./tiers";
import type {
  AdventureKind,
  AdventureOption,
  BuildSnapshot,
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
  "adventure",
  "bot",
  "market",
  "adventure",
  "bot",
  "adventure",
  "market",
  "player",
];
const PASSES = 3;
const PHASES: Phase[] = Array.from({ length: PASSES }, () => PHASE_UNIT).flat();

// Mana por rodada = base fixa garantida + bônus do dado. Reduz a sorte e sempre
// permite comprar algumas cartas no começo. Bônus: face 1-2→+0, 3-4→+1, 5-6→+2.
const DICE_BASE_MANA = 2;
function diceManaGain(face: number): number {
  return DICE_BASE_MANA + Math.floor((Math.max(1, Math.min(6, face)) - 1) / 2);
}

export interface Shop {
  category: ShopCategory;
  items: CardInstance[];
}

/** Dados do vendedor exibidos na dica flutuante da carta de loja. */
export interface SellerInfo {
  name: string;
  description: string;
  category: ShopCategory;
}

interface OpponentState {
  build: OpponentBuild;
  cards: (CardInstance | null)[];
  isPlayer: boolean;
}

interface AdventureState {
  options: AdventureOption[];
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
  theme: ShopCategory | null; // influência do NPC escolhido

  hand: CardInstance[];
  slots: (CardInstance | null)[];
  shops: Shop[];
  shopView: number | null;
  opponent: OpponentState | null;
  botChoices: OpponentBuild[] | null; // 3 NPCs para escolher (fase bot)
  versusOpen: boolean; // modal de confronto (fase player)
  adventure: AdventureState;

  playerHealth: number;
  playerMaxHealth: number;
  // Vida máxima conquistada com CURA durante a batalha em andamento: o que
  // transborda do teto vira vida máxima em vez de se perder. Zera a cada
  // batalha, então não compõe entre lutas.
  playerMaxHealthGain: number;
  opponentHealth: number;
  opponentMaxHealth: number;
  opponentMaxHealthGain: number;
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

  /**
   * Dica flutuante da carta. Substitui o antigo `modalCard`: a âncora é o
   * elemento DOM que disparou o hover, porque a carta tem `overflow: hidden` e
   * o tooltip é posicionado em `document.body` (ver `CardTipHost`).
   */
  cardTip: { card: CardInstance; anchor: HTMLElement; hideTier?: boolean } | null;

  /**
   * Dica flutuante do vendedor (carta de loja do bazar). Mostra nome e
   * descrição do vendedor. Usa a mesma âncora/portal do `cardTip`, mas com
   * conteúdo próprio (ver `CardTipHost` / `SellerTooltip`).
   */
  sellerTip: { seller: SellerInfo; anchor: HTMLElement } | null;

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
  chooseBot: (index: number) => void;
  startVersus: () => void;
  pickAdventure: (id: string) => void;
  requestMerge: (sourceId: string, targetId: string) => void;
  confirmMerge: () => void;
  cancelMerge: () => void;
  armJoker: (id: string | null) => void;
  applyJoker: (cardId: string) => void;
  openCardTip: (card: CardInstance, anchor: HTMLElement, hideTier?: boolean) => void;
  closeCardTip: () => void;
  openSellerTip: (seller: SellerInfo, anchor: HTMLElement) => void;
  closeSellerTip: () => void;
  resolveBattleEffect: (
    side: Side,
    effectType: EffectType,
    value: number,
  ) => EffectResolution | null;
  fogDamage: (amount: number) => { player: number; opponent: number } | null;
  /** Sangramento de YAMATO: dano direto só no oponente (ignora escudo). */
  bleedOpponent: (amount: number) => number;

  canAdvance: () => boolean;
  passNumber: () => number;
  isCombat: () => boolean;
  effectiveMaxHealth: () => number;
}

const DEFAULT_CONFIG: CatalogConfig = {
  maxHandSize: 999,
  shopTestPrice: 1,
  infiniteMana: false,
  maxHealth: 20,
  maxMana: 15,
};

const EMPTY_ADVENTURE: AdventureState = { options: [], picked: false };
const MAXHP_GAIN = 10;

function makeCard(def: CardDef, tier = 0, video?: string): CardInstance {
  return { id: nextId(def.kind), def, tier, art: artFor(def, video) };
}

// Categoria dominante do deck de um NPC (vira o "tema" influente).
function dominantCategory(build: OpponentBuild, deck: CardDef[]): ShopCategory {
  const counts: Record<ShopCategory, number> = { dano: 0, cura: 0, aceleracao: 0, escudo: 0 };
  for (const id of build.deck) {
    const def = deck.find((d) => d.id === id);
    if (def) counts[categoryOf(def)] += 1;
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as ShopCategory) ?? "dano";
}

// Lojas do bazar; o tema (se houver) deixa a loja daquela categoria um tier acima.
function buildShops(deck: CardDef[], video?: string, theme?: ShopCategory | null): Shop[] {
  return SHOP_ORDER.map((category) => {
    const pool = deck.filter((d) => d.enabled !== false && categoryOf(d) === category);
    const count = Math.min(3, Math.max(2, pool.length));
    const baseTier = theme && category === theme ? 1 : 0;
    const items = shuffle(pool).slice(0, count).map((def) => makeCard(def, baseTier, video));
    return { category, items };
  }).filter((shop) => shop.items.length > 0);
}

// 3 situações da aventura: carta melhorada (do tema), +vida máxima e coringa alto.
function makeAdventure(
  deck: CardDef[],
  theme: ShopCategory | null,
  pass: number,
  video?: string,
): AdventureState {
  const kinds = shuffle<AdventureKind>(["card", "maxhp", "joker"]);
  const options: AdventureOption[] = kinds.map((kind) => {
    const id = nextId("adv");
    if (kind === "card") {
      const themed = deck.filter((d) => d.enabled !== false && (!theme || categoryOf(d) === theme));
      const pool = themed.length ? themed : deck.filter((d) => d.enabled !== false);
      const src = pool[Math.floor(Math.random() * pool.length)] ?? deck[0];
      const tier = Math.min(MAX_TIER, 2 + pass);
      return {
        id,
        kind,
        title: "RELÍQUIA",
        desc: `Ganhe ${src.name} (tier ${tierKey(tier)}).`,
        icon: "🃏",
        card: makeCard(src, tier, video),
      };
    }
    if (kind === "maxhp") {
      return {
        id,
        kind,
        title: "FONTE VITAL",
        desc: `+${MAXHP_GAIN} de vida máxima.`,
        icon: "❤",
        amount: MAXHP_GAIN,
      };
    }
    const tier = Math.min(MAX_TIER, 3 + pass);
    return {
      id,
      kind,
      title: "CORINGA RARO",
      desc: `Ganhe um coringa tier ${tierKey(tier)}.`,
      icon: "★",
      tier,
    };
  });
  return { options, picked: false };
}

function buildOpponent(build: OpponentBuild, deck: CardDef[], tier: number, isPlayer: boolean): OpponentState {
  const video = randomVideoSrc();
  const cards: (CardInstance | null)[] = [];
  build.deck.forEach((cardId) => {
    const def = deck.find((d) => d.id === cardId);
    if (!def) throw new Error(`Deck do oponente referencia carta desconhecida "${cardId}".`);
    cards.push(makeCard(def, tier, video));
  });
  while (cards.length < 4) cards.push(null);
  return { build, cards, isPlayer };
}

// Monta o oponente a partir de um snapshot de jogador real: tier por carta e
// mago próprios da build gravada (a vida máxima vem no próprio snapshot).
function buildOpponentFromSnapshot(snap: BuildSnapshot, deck: CardDef[]): OpponentState {
  const video = randomVideoSrc();
  const mage = getMage(snap.mageId);
  const cards: (CardInstance | null)[] = snap.slots.map((slot) => {
    if (!slot) return null;
    const def = deck.find((d) => d.id === slot.cardId);
    return def ? makeCard(def, slot.tier, video) : null;
  });
  while (cards.length < 4) cards.push(null);
  const build: OpponentBuild = {
    name: snap.name,
    portrait: mage ? mage.portrait.split("/").pop() ?? "cover-3.jpg" : "cover-3.jpg",
    background: mage?.theme ?? "",
    deck: snap.slots.flatMap((s) => (s ? [s.cardId] : [])),
  };
  return { build, cards, isPlayer: true };
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
  theme: null,

  hand: [],
  slots: [null, null, null, null],
  shops: [],
  shopView: null,
  opponent: null,
  botChoices: null,
  versusOpen: false,
  adventure: EMPTY_ADVENTURE,

  playerHealth: DEFAULT_CONFIG.maxHealth,
  playerMaxHealth: DEFAULT_CONFIG.maxHealth,
  playerMaxHealthGain: 0,
  opponentHealth: DEFAULT_CONFIG.maxHealth,
  opponentMaxHealth: DEFAULT_CONFIG.maxHealth,
  opponentMaxHealthGain: 0,
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

  cardTip: null,
  sellerTip: null,

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
      playerMaxHealth: config.maxHealth,
      playerMaxHealthGain: 0,
      playerShield: 0,
      mana: 0,
      theme: null,
      jokers: [],
      victories: 0,
      runComplete: false,
    });
    enterPhase(0, set, get);
  },

  rollDie: (face) => {
    const { phase, hasRolledThisMarket, config, mana } = get();
    if (phase !== "market" || hasRolledThisMarket) return;
    const nextMana = config.infiniteMana ? mana : Math.min(config.maxMana, mana + diceManaGain(face));
    set({ hasRolledThisMarket: true, mana: nextMana });
    playEvent("event:dice");
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
    const b = bought as CardInstance;
    set({ shops: nextShops, hand: [...hand, makeCard(b.def, b.tier, get().mage?.video)] });
    playEvent("event:buy");
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
    playEvent("event:cardPlaced");
    // Fala extra do mago: 30% de chance, e só ao posicionar no tabuleiro.
    playMageCardPlace(get().mage);
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
    } else if (s.phase === "adventure") {
      if (!s.adventure.picked) return;
    } else {
      return;
    }
    enterPhase(s.phaseIndex + 1, set, get);
  },

  continueAfterWin: () => {
    const s = get();
    if (s.battleWinner !== "player") {
      // Derrota: só perde a run se for contra um JOGADOR (fase "player"/rival).
      // Perder para um NPC (bot) NÃO encerra a run — segue para a próxima fase,
      // sem ganhar vitória nem coringa.
      if (s.phase === "player") {
        get().restartRun();
        return;
      }
      set({ battleResultOpen: false });
      if (s.phaseIndex + 1 >= PHASES.length) {
        set({ runComplete: true, battleActive: false });
        return;
      }
      enterPhase(s.phaseIndex + 1, set, get);
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
    // Recomeçando: cala a fala que ainda tocava e limpa o guarda, para a
    // INTRO da primeira fase não ser engolida pela fala da run anterior.
    resetMageVoice();
    set({
      hand: [],
      slots: [null, null, null, null],
      playerHealth: config.maxHealth,
      playerMaxHealth: config.maxHealth,
      playerMaxHealthGain: 0,
      playerShield: 0,
      opponentShield: 0,
      mana: 0,
      theme: null,
      opponent: null,
      botChoices: null,
      versusOpen: false,
      adventure: EMPTY_ADVENTURE,
      battleActive: false,
      battleWinner: null,
      battleResultOpen: false,
      battleOpponentName: null,
      runComplete: false,
      victories: 0,
      jokers: [],
      armedJokerId: null,
      mergePrompt: null,
      cardTip: null,
    });
    enterPhase(0, set, get);
  },

  chooseBot: (index) => {
    const s = get();
    if (s.phase !== "bot" || !s.botChoices || !s.botChoices[index]) return;
    playEvent("event:newBoard");
    // Fase de batalha: a fala é BATTLE_STARTS, nunca a INTRO.
    playMageLine(s.mage, "BATTLE_STARTS");
    const build = s.botChoices[index];
    const pass = Math.floor(s.phaseIndex / PHASE_UNIT.length);
    const opponent = buildOpponent(build, s.deck, Math.min(MAX_TIER, pass), false);
    set({
      opponent,
      botChoices: null,
      theme: dominantCategory(build, s.deck),
      // Vida máxima do jogador na largada: base + passiva. O ganho de cura da
      // batalha anterior não compõe — a cura guarda vida só dentro da luta.
      playerHealth: effectiveMaxHealth(s.playerMaxHealth, s.mage, s.hand),
      playerMaxHealthGain: 0,
      playerShield: 0,
      opponentHealth: s.config.maxHealth,
      opponentMaxHealth: s.config.maxHealth,
      opponentMaxHealthGain: 0,
      opponentShield: 0,
      opponentHealthVisible: true,
      battleActive: true,
      battleOpponentName: build.name,
    });
  },

  startVersus: () => {
    const s = get();
    if (s.phase !== "player" || !s.opponent) return;
    playEvent("event:newBoard");
    // Fase de batalha: a fala é BATTLE_STARTS, nunca a INTRO.
    playMageLine(s.mage, "BATTLE_STARTS");
    set({
      versusOpen: false,
      playerHealth: effectiveMaxHealth(s.playerMaxHealth, s.mage, s.hand),
      playerMaxHealthGain: 0,
      playerShield: 0,
      opponentHealth: s.opponentMaxHealth,
      opponentMaxHealthGain: 0,
      opponentShield: 0,
      opponentHealthVisible: true,
      battleActive: true,
    });
  },

  pickAdventure: (id) => {
    const s = get();
    if (s.phase !== "adventure" || s.adventure.picked) return;
    const opt = s.adventure.options.find((o) => o.id === id);
    if (!opt) return;
    playEvent("event:optionSelected");
    if (opt.kind === "card" && opt.card) {
      set({ hand: [...s.hand, opt.card] });
    } else if (opt.kind === "maxhp" && opt.amount) {
      set({
        playerMaxHealth: s.playerMaxHealth + opt.amount,
        playerHealth: s.playerHealth + opt.amount,
      });
    } else if (opt.kind === "joker" && opt.tier !== undefined) {
      set({ jokers: addJoker(s.jokers, { id: nextId("joker"), tier: opt.tier }) });
    }
    set({ adventure: { ...get().adventure, picked: true } });
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

  openCardTip: (card, anchor, hideTier) => {
    // Mantido o evento `event:cardModal`: os bindings de áudio do painel já
    // apontam para ele, então o som que você configurou continua valendo.
    playEvent("event:cardModal");
    set({ cardTip: { card, anchor, hideTier } });
  },
  closeCardTip: () => set({ cardTip: null }),

  openSellerTip: (seller, anchor) => {
    playEvent("event:cardModal");
    set({ sellerTip: { seller, anchor } });
  },
  closeSellerTip: () => set({ sellerTip: null }),

  resolveBattleEffect: (side, effectType, value) => {
    const s = get();
    if (!s.battleActive || !Number.isFinite(value) || value < 0) return null;
    const isPlayer = side === "player";
    let actualEffect: EffectType = effectType;
    let actualValue = value;
    let targetSide: Side;
    let { playerHealth, opponentHealth, playerShield, opponentShield } = s;
    let playerMaxHealthGain = s.playerMaxHealthGain;
    let opponentMaxHealthGain = s.opponentMaxHealthGain;

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
      // A cura NÃO tem teto. O que passaria do máximo não se perde: vira vida
      // máxima. 100 de vida, 60 de cura em cima => 160 de vida em 160.
      targetSide = side;
      const cap = isPlayer
        ? effectiveMaxHealth(s.playerMaxHealth, s.mage, s.hand, playerMaxHealthGain)
        : s.opponentMaxHealth + opponentMaxHealthGain;
      const previousHealth = isPlayer ? playerHealth : opponentHealth;
      const healed = previousHealth + value;
      if (healed > cap) {
        if (isPlayer) playerMaxHealthGain += healed - cap;
        else opponentMaxHealthGain += healed - cap;
      }
      if (isPlayer) playerHealth = healed;
      else opponentHealth = healed;
      actualValue = healed - previousHealth;
    } else {
      targetSide = side;
      if (isPlayer) playerShield += value;
      else opponentShield += value;
    }

    const affectedPlayer = effectType === "damage" ? !isPlayer : isPlayer;
    const resultingHealth = affectedPlayer ? playerHealth : opponentHealth;
    set({
      playerHealth,
      opponentHealth,
      playerShield,
      opponentShield,
      playerMaxHealthGain,
      opponentMaxHealthGain,
    });

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

  bleedOpponent: (amount) => {
    const s = get();
    if (!s.battleActive) return 0;
    const applied = Math.min(s.opponentHealth, amount);
    const opponentHealth = Math.max(0, s.opponentHealth - amount);
    set({ opponentHealth });
    if (opponentHealth <= 0) {
      set({ battleActive: false, battleWinner: "player", battleResultOpen: true });
    }
    return applied;
  },

  canAdvance: () => {
    const s = get();
    if (s.battleActive) return false;
    if (s.phase === "market") return s.hasRolledThisMarket;
    if (s.phase === "adventure") return s.adventure.picked;
    return false;
  },
  passNumber: () => Math.floor(get().phaseIndex / PHASE_UNIT.length) + 1,
  isCombat: () => {
    const p = get().phase;
    return p === "bot" || p === "player";
  },
  effectiveMaxHealth: () => {
    const s = get();
    return effectiveMaxHealth(s.playerMaxHealth, s.mage, s.hand, s.playerMaxHealthGain);
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
  const s = get();
  const common: Partial<GameState> = {
    phaseIndex: index,
    phase,
    battleResultOpen: false,
    battleWinner: null,
    armedJokerId: null,
    mergePrompt: null,
    battleActive: false,
    opponentHealthVisible: false,
    opponentMaxHealth: s.config.maxHealth,
    // Nenhuma fase carrega vida máxima de cura da luta anterior.
    playerMaxHealthGain: 0,
    opponentMaxHealthGain: 0,
    opponent: null,
    botChoices: null,
    versusOpen: false,
    shops: [],
    shopView: null,
    adventure: EMPTY_ADVENTURE,
  };

  // Fala do mago: a INTRO toca só quando a PRIMEIRA fase da run começa
  // (index 0). Nas demais fases ela não toca; em `bot`/`player` quem fala é
  // BATTLE_STARTS, no momento em que a luta começa (chooseBot / startVersus).
  if (phase === "market") {
    set({
      ...common,
      hasRolledThisMarket: false,
      shops: buildShops(s.deck, s.mage?.video, s.theme),
    });
    playEvent("event:newCards");
    if (index === 0) playMageLine(s.mage, "INTRO");
    return;
  }

  if (phase === "adventure") {
    set({
      ...common,
      adventure: makeAdventure(s.deck, s.theme, pass, s.mage?.video),
    });
    playEvent("event:newCards");
    return;
  }

  if (phase === "bot") {
    // 3 NPCs para escolher; a luta começa após a escolha (chooseBot).
    set({ ...common, botChoices: shuffle(s.farmBots).slice(0, 3) });
    playEvent("event:newBoard");
    return;
  }

  // player: confronto assíncrono contra a build de um jogador real.
  // Mostra de imediato um rival estático (fallback) e, em paralelo, busca um
  // snapshot do mesmo "pass"; se houver, substitui o oponente antes da luta.
  const build = s.rivalBuilds[Math.floor(Math.random() * s.rivalBuilds.length)];
  const opponent = buildOpponent(build, s.deck, Math.min(MAX_TIER, pass), true);
  set({
    ...common,
    opponent,
    opponentMaxHealth: s.config.maxHealth,
    versusOpen: true,
    battleOpponentName: build.name,
  });

  const passNo = pass + 1; // 1..3
  void fetchOpponentSnapshot(passNo).then((snap) => {
    if (!snap) return;
    const cur = get();
    // Só aplica se ainda estamos no mesmo versus aguardando (sem luta iniciada).
    if (cur.phase !== "player" || !cur.versusOpen || cur.battleActive) return;
    const realOpponent = buildOpponentFromSnapshot(snap, cur.deck);
    set({
      opponent: realOpponent,
      opponentMaxHealth: snap.maxHealth,
      battleOpponentName: snap.name,
    });
  });
}
