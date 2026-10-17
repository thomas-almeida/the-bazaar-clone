// Regressões do balanceamento do dado e do loop de derrota (2026-10).
//
// Dado: mana por rodada = base fixa (2) + bônus do dado (face 1-2→+0, 3-4→+1,
// 5-6→+2), com teto em config.maxMana. Reduz a sorte e garante compra no início.
//
// Loop: perder para um NPC (fase "bot") NÃO encerra a run — segue para a
// próxima fase sem vitória. Só perder para um jogador (fase "player"/rival)
// reinicia a run.

import { describe, expect, it, beforeEach } from "vitest";
import { useGame } from "@/lib/store";

const baseConfig = { maxHandSize: 7, shopTestPrice: 1, infiniteMana: false, maxHealth: 100, maxMana: 15 };

describe("dado: base fixa + bônus (menos sorte, piso garantido)", () => {
  beforeEach(() => {
    useGame.setState({ phase: "market", mana: 0, hasRolledThisMarket: false, config: baseConfig });
  });

  function roll(face: number): number {
    useGame.setState({ mana: 0, hasRolledThisMarket: false });
    useGame.getState().rollDie(face);
    return useGame.getState().mana;
  }

  it("mapeia a face para base 2 + bônus 0/1/2", () => {
    expect(roll(1)).toBe(2);
    expect(roll(2)).toBe(2);
    expect(roll(3)).toBe(3);
    expect(roll(4)).toBe(3);
    expect(roll(5)).toBe(4);
    expect(roll(6)).toBe(4);
  });

  it("sempre permite comprar ao menos 1 carta (piso 2 ≥ preço 1)", () => {
    expect(roll(1)).toBeGreaterThanOrEqual(baseConfig.shopTestPrice);
  });

  it("respeita o teto de mana", () => {
    useGame.setState({ mana: 14, hasRolledThisMarket: false });
    useGame.getState().rollDie(6);
    expect(useGame.getState().mana).toBe(15);
  });

  it("não rola fora do mercado nem duas vezes na mesma rodada", () => {
    useGame.setState({ phase: "market", mana: 0, hasRolledThisMarket: false });
    useGame.getState().rollDie(5);
    const after = useGame.getState().mana;
    useGame.getState().rollDie(5); // segunda vez: ignorado
    expect(useGame.getState().mana).toBe(after);

    useGame.setState({ phase: "bot", mana: 0, hasRolledThisMarket: false });
    useGame.getState().rollDie(5);
    expect(useGame.getState().mana).toBe(0);
  });
});

describe("loop: derrota para NPC não perde a run; para jogador, sim", () => {
  beforeEach(() => {
    useGame.setState({ config: baseConfig, deck: [], mage: null, theme: null });
  });

  it("perder para NPC (bot) segue para a próxima fase, sem reiniciar", () => {
    useGame.setState({
      phase: "bot",
      phaseIndex: 2, // próxima fase = mercado
      battleWinner: "opponent",
      battleResultOpen: true,
      battleActive: false,
      victories: 1,
    });
    useGame.getState().continueAfterWin();
    const s = useGame.getState();
    expect(s.phaseIndex, "avançou de fase").toBe(3);
    expect(s.victories, "não ganhou vitória, mas não zerou (não reiniciou)").toBe(1);
    expect(s.battleResultOpen).toBe(false);
  });

  it("perder para jogador (rival) reinicia a run", () => {
    useGame.setState({
      phase: "player",
      phaseIndex: 8,
      battleWinner: "opponent",
      battleResultOpen: true,
      battleActive: false,
      victories: 2,
    });
    useGame.getState().continueAfterWin();
    const s = useGame.getState();
    expect(s.phaseIndex, "voltou ao início").toBe(0);
    expect(s.victories, "run reiniciada").toBe(0);
  });
});
