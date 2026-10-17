// Regressões do sangramento de YAMATO (2026-10).
//
// Yamato (passiva "bleed-wakizashi") faz o oponente sangrar enquanto houver uma
// peça WAKIZASHI no tabuleiro; o passo por segundo soma a contribuição das peças
// (escalada pelo tier). bleedOpponent aplica dano direto só no oponente.

import { describe, expect, it, beforeEach } from "vitest";
import { bleedStepPerSecond } from "@/lib/passives";
import { getMage, MAGES } from "@/lib/mages";
import { useGame } from "@/lib/store";
import type { CardInstance } from "@/lib/types";

const yamato = getMage("yamato")!;
const sydra = getMage("neon")!;

function wakizashi(tier = 0): CardInstance {
  return {
    id: "w1",
    tier,
    art: { kind: "image", src: "/x.png" },
    def: { id: "wakizashi", name: "WAKIZASHI", kind: "equipment", cost: 3, cooldown: 0, piece: true, bleed: 1, description: "" },
  };
}

function creature(): CardInstance {
  return {
    id: "c1",
    tier: 0,
    art: { kind: "image", src: "/x.png" },
    def: { id: "dragon", name: "DRAGON", kind: "creature", cost: 1, cooldown: 2, damage: 2, description: "" },
  };
}

describe("YAMATO existe com a passiva de sangramento", () => {
  it("está no elenco com a passiva bleed-wakizashi", () => {
    expect(yamato.name).toBe("YAMATO");
    expect(yamato.passive).toBe("bleed-wakizashi");
    expect(MAGES.some((m) => m.id === "yamato")).toBe(true);
  });
});

describe("bleedStepPerSecond", () => {
  it("é zero sem a passiva de Yamato (mesmo com WAKIZASHI)", () => {
    expect(bleedStepPerSecond([wakizashi(), null, null, null], sydra)).toBe(0);
  });

  it("é zero com Yamato mas sem peça no tabuleiro", () => {
    expect(bleedStepPerSecond([creature(), null, null, null], yamato)).toBe(0);
  });

  it("soma o sangramento das peças com Yamato", () => {
    expect(bleedStepPerSecond([wakizashi(), null, null, null], yamato)).toBe(1);
    expect(bleedStepPerSecond([wakizashi(), wakizashi(), null, null], yamato)).toBe(2);
  });

  it("escala pelo tier da peça", () => {
    // tier mais alto aumenta o passo (tierValue cresce com o tier).
    expect(bleedStepPerSecond([wakizashi(3), null, null, null], yamato)).toBeGreaterThan(1);
  });
});

describe("bleedOpponent (store)", () => {
  beforeEach(() => {
    useGame.setState({ battleActive: true, playerHealth: 100, opponentHealth: 30, battleWinner: null, battleResultOpen: false });
  });

  it("tira vida só do oponente", () => {
    const applied = useGame.getState().bleedOpponent(5);
    expect(applied).toBe(5);
    expect(useGame.getState().opponentHealth).toBe(25);
    expect(useGame.getState().playerHealth).toBe(100);
  });

  it("encerra a batalha quando o oponente chega a zero (vitória do jogador)", () => {
    useGame.getState().bleedOpponent(999);
    expect(useGame.getState().opponentHealth).toBe(0);
    expect(useGame.getState().battleActive).toBe(false);
    expect(useGame.getState().battleWinner).toBe("player");
  });

  it("não faz nada fora de batalha", () => {
    useGame.setState({ battleActive: false });
    expect(useGame.getState().bleedOpponent(5)).toBe(0);
  });
});
