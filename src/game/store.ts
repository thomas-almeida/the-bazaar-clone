import { create } from 'zustand';
import type { RunState, Elem, CardInstance, BoardCell, JungleMob, Snapshot } from './types';
import { createEmptyBoard, creaturesOnBoard } from './board';
import { startingDeck, shopPool } from './data/cards';
import { generateLoopSnapshots } from './bot';
import { simulateBattle, type BattleResult } from './combat/simulate';
import {
  PLAYER_START_HP,
  SHOP_OFFERS,
  WINS_TO_COMPLETE_RUN,
  SHOTS_PER_CREATURE_FARM,
  ELEMENTAL_BONUS_CAP,
  EARLY_MANA_BONUS,
} from './data/constants';

let uidCounter = 0;
const uid = () => `card_${uidCounter++}`;

function draw(defs: ReturnType<typeof startingDeck>): CardInstance[] {
  return defs.map((def) => ({ uid: uid(), def }));
}

function rollShop(elem: Elem): CardInstance[] {
  const pool = shopPool(elem);
  const offers: CardInstance[] = [];
  for (let i = 0; i < SHOP_OFFERS; i++) {
    const def = pool[Math.floor(Math.random() * pool.length)];
    offers.push({ uid: uid(), def });
  }
  return offers;
}

interface GameActions {
  startRun: (character: Elem) => void;
  rollDice: (forced?: number) => void;
  buyOffer: (uid: string) => void;
  rerollShop: () => void;
  playCard: (handUid: string, cellIndex: number) => boolean;
  endShop: () => void;
  setupFarm: () => void;
  runFarm: () => FarmResult | null;
  endFarm: () => void;
  startBattle: () => BattleResult | null;
  resolveBattle: (result: BattleResult) => void;
  nextRound: () => void;
  reset: () => void;
}

export interface FarmResult {
  mobs: JungleMob[];
  manaGained: number;
  heal: number;
  log: string[];
}

type Store = RunState & GameActions & {
  jungle: JungleMob[];
  currentEnemy: Snapshot | null;
  lastBattle: BattleResult | null;
};

function hasDepot(board: BoardCell[]): boolean {
  return board.some((c) => c.occupant?.id === 'depot');
}

function freshState(): RunState & { jungle: JungleMob[]; currentEnemy: Snapshot | null; lastBattle: BattleResult | null } {
  return {
    character: 'fire',
    playerHP: PLAYER_START_HP,
    mana: 0,
    round: 0,
    wins: 0,
    phase: 'menu',
    hand: [],
    board: createEmptyBoard(),
    shopOffers: [],
    snapshots: [],
    lastDice: null,
    log: [],
    jungle: [],
    currentEnemy: null,
    lastBattle: null,
  };
}

export const useGame = create<Store>((set, get) => ({
  ...freshState(),

  startRun: (character) => {
    // Fôlego inicial: criatura fraca já posicionada (casa 1, com terreno) + 2º terreno na mão.
    const deck = startingDeck(character);
    const weakIdx = deck.findIndex((d) => d.kind === 'creature' && d.tier === 'weak');
    const terrainDef = deck.find((d) => d.kind === 'terrain')!;
    const board = createEmptyBoard();
    if (weakIdx >= 0) {
      board[1].terrain = character;
      board[1].terrainStack = 1;
      board[1].occupant = deck[weakIdx];
      deck.splice(weakIdx, 1);
    }
    deck.push(terrainDef);
    set({
      ...freshState(),
      character,
      phase: 'dice',
      round: 1,
      board,
      hand: draw(deck),
      snapshots: generateLoopSnapshots(),
      log: [`Run iniciada como ${character}.`],
    });
  },

  rollDice: (forced) => {
    const s = get();
    if (s.phase !== 'dice') return;
    const roll =
      forced !== undefined && forced >= 1 && forced <= 6
        ? Math.floor(forced)
        : 1 + Math.floor(Math.random() * 6);
    const depotBonus = hasDepot(s.board) ? 2 : 0;
    const earlyBonus = EARLY_MANA_BONUS[s.round - 1] ?? 0;
    const gained = roll + depotBonus + earlyBonus;
    set({
      mana: s.mana + gained,
      lastDice: roll,
      phase: 'shop',
      shopOffers: rollShop(s.character),
      log: [
        ...s.log,
        `Dado: ${roll}${depotBonus ? ` (+${depotBonus} Depósito)` : ''}${earlyBonus ? ` (+${earlyBonus} bônus inicial)` : ''}. Mana: ${s.mana + gained}.`,
      ],
    });
  },

  buyOffer: (offerUid) => {
    const s = get();
    const offer = s.shopOffers.find((o) => o.uid === offerUid);
    if (!offer) return;
    const price = offer.def.cost + 1;
    if (s.mana < price) {
      set({ log: [...s.log, `Mana insuficiente para ${offer.def.name}.`] });
      return;
    }
    set({
      mana: s.mana - price,
      hand: [...s.hand, { uid: uid(), def: offer.def }],
      shopOffers: s.shopOffers.filter((o) => o.uid !== offerUid),
      log: [...s.log, `Comprou ${offer.def.name} por ${price} mana.`],
    });
  },

  rerollShop: () => {
    const s = get();
    if (s.mana < 1) return;
    set({ mana: s.mana - 1, shopOffers: rollShop(s.character), log: [...s.log, 'Reroll da loja (-1 mana).'] });
  },

  playCard: (handUid, cellIndex) => {
    const s = get();
    const card = s.hand.find((c) => c.uid === handUid);
    if (!card) return false;
    const def = card.def;

    const board = s.board.map((c) => ({ ...c, items: [...c.items] }));
    const target = board[cellIndex];

    if (def.kind === 'terrain') {
      // Pinta/repinta. Mesmo elemento em cima = empilha (bônus §4).
      if (target.terrain === def.elem) target.terrainStack = Math.min(2, target.terrainStack + 1);
      else {
        target.terrain = def.elem;
        target.terrainStack = 1;
      }
      set({ board, hand: s.hand.filter((c) => c.uid !== handUid), log: [...s.log, `Terreno ${def.elem} em (${cellIndex}).`] });
      return true;
    }

    if (def.kind === 'item') {
      if (!target.occupant && target.terrain === null) return false;
      target.items.push({ defId: def.id });
      set({ board, hand: s.hand.filter((c) => c.uid !== handUid), log: [...s.log, `Equipou ${def.name}.`] });
      return true;
    }

    // criatura ou construção — precisa de mana, casa vazia e terreno do elemento (criatura)
    if (s.mana < def.cost) return false;
    if (target.occupant) return false;
    if (def.kind === 'creature' && target.terrain !== def.elem) {
      set({ log: [...s.log, `Precisa de terreno ${def.elem} nessa casa.`] });
      return false;
    }
    target.occupant = def;
    set({
      board,
      mana: s.mana - def.cost,
      hand: s.hand.filter((c) => c.uid !== handUid),
      log: [...s.log, `Invocou ${def.name} (-${def.cost} mana).`],
    });
    return true;
  },

  endShop: () => {
    const s = get();
    // Rodadas ímpares = farm (preparação); pares = batalha contra snapshot (§2/§6).
    const goFarm = s.round % 2 === 1;
    if (goFarm) {
      get().setupFarm();
    } else {
      get().startBattle();
    }
  },

  setupFarm: () => {
    const s = get();
    const count = 2 + Math.floor(Math.random() * 3); // 2..4
    const elems: Elem[] = ['fire', 'water', 'grass'];
    const mobs: JungleMob[] = Array.from({ length: count }, (_, i) => ({
      index: i,
      elem: elems[Math.floor(Math.random() * 3)],
      hp: 1 + Math.floor(Math.random() * 3), // 1..3
    }));
    set({
      jungle: mobs,
      phase: 'farm',
      log: [...s.log, `Fase de farm: ${count} mobs de jungle apareceram.`],
    });
  },

  runFarm: () => {
    const s = get();
    // Resolve usando os mobs já preparados em setupFarm (não gera novos).
    const mobs: JungleMob[] = s.jungle.map((m) => ({ ...m }));
    const count = mobs.length;
    const originalHp = new Map(s.jungle.map((m) => [m.index, m.hp]));

    const creatures = creaturesOnBoard(s.board);
    let manaGained = 0;
    const queue = [...mobs];
    for (const cr of creatures) {
      let shots = SHOTS_PER_CREATURE_FARM;
      const atk = cr.occupant!.shotDamage ?? 0;
      while (shots > 0 && queue.length > 0) {
        const mob = queue[0];
        mob.hp -= atk;
        shots--;
        if (mob.hp <= 0) {
          manaGained += Math.floor((originalHp.get(mob.index) ?? 1) / 2) || 1;
          queue.shift();
        }
      }
    }

    // Bônus elemental por criatura em campo (teto 3 por elemento)
    const counts: Record<Elem, number> = { fire: 0, water: 0, grass: 0 };
    for (const cr of creatures) counts[cr.occupant!.elem]++;
    const heal = Math.min(counts.grass, ELEMENTAL_BONUS_CAP);

    const log = [
      `Farm: ${count} mobs. Mana ganha: +${manaGained}.`,
      heal ? `Grama curou +${heal} HP.` : '',
    ].filter(Boolean);

    // Atualiza jungle: remove abatidos, mantém HP restante dos sobreviventes.
    const survivors = mobs.filter((m) => m.hp > 0);

    set({
      jungle: survivors,
      mana: s.mana + manaGained,
      playerHP: Math.min(PLAYER_START_HP, s.playerHP + heal),
      log: [...s.log, ...log],
    });
    return { mobs, manaGained, heal, log };
  },

  endFarm: () => set({ phase: 'dice', round: get().round + 1 }),

  startBattle: () => {
    const s = get();
    const enemy = s.snapshots[s.wins];
    if (!enemy) return null;
    const result = simulateBattle(s.board, enemy.board, s.playerHP, enemy.hp);
    set({ phase: 'battle', currentEnemy: enemy, lastBattle: result });
    return result;
  },

  resolveBattle: (result) => {
    const s = get();
    if (result.winner === 'player') {
      const wins = s.wins + 1;
      const done = wins >= WINS_TO_COMPLETE_RUN;
      set({
        wins,
        playerHP: result.playerHP,
        phase: done ? 'gameover' : 'result',
        log: [...s.log, `Vitória! (${wins}/${WINS_TO_COMPLETE_RUN})${done ? ' RUN VENCIDA!' : ''}`],
      });
    } else {
      set({
        playerHP: 0,
        phase: 'gameover',
        log: [...s.log, 'Derrota. A run acabou.'],
      });
    }
  },

  nextRound: () => set({ phase: 'dice', round: get().round + 1 }),

  reset: () => set(freshState()),
}));
