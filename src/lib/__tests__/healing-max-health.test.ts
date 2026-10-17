// Regressões da vida máxima sem teto.
//
// Mecânica pedida (2026-10): a cura não tem mais teto. O que passaria da vida
// máxima vira vida máxima. Exemplo do pedido: 100 de vida, cheia, +60 de cura
// => 160 de vida em 160.
//
// Duas decisões tomadas com o usuário:
//  - o ganho é por batalha: a próxima luta volta à base (cura GUARDA vida, não
//    compõe entre lutas);
//  - vale para os dois lados (NPC e rival), senão carta de cura seria forte
//    contra o jogador e inútil contra o NPC.
//
// Bug pré-existente corrigido junto: a barra do oponente usava
// config.maxHealth em vez de opponentMaxHealth, então contra um rival real de
// 200 de vida ela limitaria a exibição em 100.

import { beforeEach, describe, expect, it } from "vitest";
import { useGame } from "@/lib/store";
import { effectiveMaxHealth } from "@/lib/passives";
import { getMage } from "@/lib/mages";
import type { CardDef, CatalogConfig, OpponentBuild } from "@/lib/types";

const CONFIG: CatalogConfig = {
  maxHandSize: 999,
  shopTestPrice: 1,
  infiniteMana: true,
  maxHealth: 100,
  maxMana: 10,
};

const MAGE = getMage("aurea")!; // AURORA, sem passiva de vida máxima

const FARM_BOTS: OpponentBuild[] = [
  { name: "NPC 1", portrait: "a.jpg", background: "", deck: ["dragon-whelp"] },
  { name: "NPC 2", portrait: "b.jpg", background: "", deck: ["dragon-whelp"] },
  { name: "NPC 3", portrait: "c.jpg", background: "", deck: ["dragon-whelp"] },
];

const RIVAL_BUILDS: OpponentBuild[] = FARM_BOTS;

// Deck mínimo com a carta que os NPCs usam — buildOpponent resolve por id.
const DECK: CardDef[] = [
  { id: "dragon-whelp", name: "DRAGON WHELP", kind: "creature", level: 1, cost: 4, cooldown: 4, damage: 2, description: "d" },
  { id: "healing-rain", name: "HEALING RAIN", kind: "spell", cost: 3, cooldown: 3, effectType: "healing", effectValue: 4, description: "c" },
];

/** Coloca o jogo numa batalha ativa com a vida cheia. */
function startBattle(opts?: { playerBase?: number; opponentBase?: number }) {
  const s = useGame.getState();
  useGame.setState({
    battleActive: true,
    battleResultOpen: false,
    playerHealth: opts?.playerBase ?? 100,
    playerMaxHealth: opts?.playerBase ?? 100,
    playerMaxHealthGain: 0,
    opponentHealth: opts?.opponentBase ?? 100,
    opponentMaxHealth: opts?.opponentBase ?? 100,
    opponentMaxHealthGain: 0,
    mage: s.mage ?? MAGE,
  } as never);
}

const cap = () => useGame.getState().playerMaxHealth + useGame.getState().playerMaxHealthGain;

beforeEach(() => {
  // zustand é um singleton: cada teste recomeça de um estado limpo conhecido.
  useGame.setState({
    playerHealth: 100,
    playerMaxHealth: 100,
    playerMaxHealthGain: 0,
    opponentHealth: 100,
    opponentMaxHealth: 100,
    opponentMaxHealthGain: 0,
    config: CONFIG,
    mage: MAGE,
    deck: DECK,
    farmBots: FARM_BOTS,
    rivalBuilds: RIVAL_BUILDS,
    hand: [],
    slots: [null, null, null, null],
    opponent: { build: FARM_BOTS[0], cards: [], isPlayer: false },
    battleActive: false,
    // Estado de loja já rolado, para advancePhase passar pela guarda.
    phase: "market",
    phaseIndex: 0,
    hasRolledThisMarket: true,
    shops: [{ category: "dano", items: [] }],
    adventure: { options: [], picked: false },
    jokers: [],
  } as never);
  // opacidade: init não precisa rodar para testar resolveBattleEffect
  useGame.setState({ loaded: true } as never);
});

describe("cura sem teto", () => {
  it("o exemplo do pedido: 100/100 + 60 de cura => 160/160", () => {
    startBattle();
    const r = useGame.getState().resolveBattleEffect("player", "healing", 60);
    const s = useGame.getState();

    expect(s.playerHealth).toBe(160);
    expect(s.playerMaxHealthGain).toBe(60);
    // teto efetivo = base 100 + ganho 60
    expect(cap()).toBe(160);
    // a cura relatada é a total, e a barra cresce junto
    expect(r?.actualValue).toBe(60);
  });

  it("cura que NÃO transborda o teto não mexe na vida máxima", () => {
    // Só existe cura sem transbordo quando o lado está ABAIXO do teto.
    startBattle();
    useGame.setState({ playerHealth: 50 } as never);
    useGame.getState().resolveBattleEffect("player", "healing", 30);
    const s = useGame.getState();
    expect(s.playerHealth).toBe(80);
    expect(s.playerMaxHealthGain).toBe(0);
    expect(s.playerMaxHealth).toBe(100);
  });

  it("a partir da vida cheia, qualquer cura transborda", () => {
    // Consequência direta da mecânica: não há teto para a cura, então curar
    // cheia sempre aumenta a vida máxima — por menor que seja o valor.
    startBattle();
    useGame.getState().resolveBattleEffect("player", "healing", 1);
    const s = useGame.getState();
    expect(s.playerMaxHealthGain).toBe(1);
    expect(s.playerHealth).toBe(101);
  });

  it("cura parcialmente além do teto cresce só o excesso", () => {
    startBattle({ playerBase: 100 });
    // jogador a 70, cura 50 => 120, transborda 20
    useGame.setState({ playerHealth: 70 } as never);
    useGame.getState().resolveBattleEffect("player", "healing", 50);
    const s = useGame.getState();
    expect(s.playerHealth).toBe(120);
    expect(s.playerMaxHealthGain).toBe(20);
  });

  it("curas sucessivas acumulam no teto", () => {
    startBattle();
    useGame.getState().resolveBattleEffect("player", "healing", 40); // 140
    useGame.getState().resolveBattleEffect("player", "healing", 40); // 180
    const s = useGame.getState();
    expect(s.playerHealth).toBe(180);
    expect(s.playerMaxHealthGain).toBe(80);
  });

  it("vida cheia + cura grande cresce o teto inteiro", () => {
    startBattle();
    useGame.getState().resolveBattleEffect("player", "healing", 200);
    const s = useGame.getState();
    expect(s.playerHealth).toBe(300);
    expect(s.playerMaxHealthGain).toBe(200);
  });
});

describe("o lado do oponente segue a mesma regra", () => {
  it("o rival também cresce a vida máxima com cura", () => {
    startBattle();
    useGame.getState().resolveBattleEffect("opponent", "healing", 60);
    const s = useGame.getState();
    expect(s.opponentHealth).toBe(160);
    expect(s.opponentMaxHealthGain).toBe(60);
    expect(s.opponentMaxHealth).toBe(100); // a base não muda
  });
});

describe("o ganho não sobrevive à batalha", () => {
  it("enterPhase zera os ganhos dos dois lados", () => {
    startBattle();
    useGame.getState().resolveBattleEffect("player", "healing", 60);
    useGame.getState().resolveBattleEffect("opponent", "healing", 60);
    expect(useGame.getState().playerMaxHealthGain).toBe(60);

    // sai da batalha e avança de fase (guards de advancePhase: precisa estar
    // fora de combate e, em loja, com o dado já rolado)
    useGame.setState({ battleActive: false, hasRolledThisMarket: true, phase: "market" } as never);
    useGame.getState().advancePhase();

    const after = useGame.getState();
    expect(after.phase).toBe("adventure");
    expect(after.playerMaxHealthGain).toBe(0);
    expect(after.opponentMaxHealthGain).toBe(0);
  });

  it("chooseBot volta a vida do jogador à base + passiva", () => {
    startBattle();
    useGame.getState().resolveBattleEffect("player", "healing", 60);
    expect(useGame.getState().playerHealth).toBe(160);

    const s = useGame.getState();
    s.phase = "bot";
    s.botChoices = FARM_BOTS;
    useGame.setState({ phase: "bot", botChoices: FARM_BOTS } as never);
    useGame.getState().chooseBot(0);

    const after = useGame.getState();
    // volta a 100 (AURORA não tem passiva de vida), e o ganho foi limpo
    expect(after.playerMaxHealthGain).toBe(0);
    expect(after.playerHealth).toBe(effectiveMaxHealth(after.playerMaxHealth, after.mage, after.hand));
  });

  it("startVersus volta a vida do jogador à base", () => {
    startBattle();
    useGame.getState().resolveBattleEffect("player", "healing", 60);
    useGame.setState({ phase: "player", versusOpen: true, opponent: { build: FARM_BOTS[0], cards: [], isPlayer: true } } as never);

    useGame.getState().startVersus();

    const after = useGame.getState();
    expect(after.playerMaxHealthGain).toBe(0);
    expect(after.opponentMaxHealthGain).toBe(0);
    expect(after.playerHealth).toBe(100);
  });
});

describe("MURALHA dobra a base, não o ganho de cura", () => {
  const EG = getMage("ferro")!; // passiva shield-maxhp

  it("sem cartas de escudo: base passa direto", () => {
    expect(effectiveMaxHealth(100, EG, [], 0)).toBe(100);
  });

  it("com 2+ escudos na mão: dobra a base", () => {
    const shield = (id: string): never =>
      ({ def: { effectType: "shield" } }) as never;
    const hand = [shield("a"), shield("b")];
    expect(effectiveMaxHealth(100, EG, hand, 0)).toBe(200);
  });

  it("o ganho de cura entra por cima, sem ser dobrado", () => {
    // Bug evitado: se o ganho fosse dobrado, 60 de cura virariam 120 de vida
    // máxima, e a carta renderia o dobro do seu valor.
    const shield = (): never => ({ def: { effectType: "shield" } }) as never;
    const hand = [shield(), shield()];
    expect(effectiveMaxHealth(100, EG, hand, 60)).toBe(260);
  });

  it("duas curas grandes com MURALHA crescem 1:1, não 1:2", () => {
    const shield = (): never => ({ def: { effectType: "shield" } }) as never;
    const hand = [shield(), shield()];

    useGame.setState({ mage: EG, hand, config: CONFIG } as never);
    startBattle({ playerBase: 100 });
    // passiva ativa: vida inicial = 200
    useGame.setState({ playerHealth: 200 } as never);

    useGame.getState().resolveBattleEffect("player", "healing", 60);
    const s = useGame.getState();
    expect(s.playerMaxHealthGain).toBe(60);
    expect(s.playerHealth).toBe(260);
    expect(effectiveMaxHealth(s.playerMaxHealth, s.mage, s.hand, s.playerMaxHealthGain)).toBe(260);
  });
});

describe("seletor do store", () => {
  it("effectiveMaxHealth devolve base + passiva + ganho", () => {
    startBattle();
    useGame.getState().resolveBattleEffect("player", "healing", 60);
    expect(useGame.getState().effectiveMaxHealth()).toBe(160);
  });
});
