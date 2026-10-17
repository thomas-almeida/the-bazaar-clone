// Garante que o roteiro do tutorial guiado avança na ordem certa e que cada
// condição de avanço reage à ação correta do jogador. Não exercita o DOM (isso
// é do TutorialOverlay); valida o contrato do roteiro, que é o que define a
// experiência de onboarding.

import { describe, expect, it } from "vitest";
import { TUTORIAL_STEPS, type TutorialProgress } from "@/lib/tutorial";

const BASE: TutorialProgress = {
  phase: "market",
  hasRolled: false,
  shopOpen: false,
  handCount: 0,
  slotsFilled: 0,
  adventurePicked: false,
  battleActive: false,
};

function step(id: string) {
  const s = TUTORIAL_STEPS.find((x) => x.id === id);
  if (!s) throw new Error(`passo "${id}" não existe`);
  return s;
}

describe("tutorial: roteiro", () => {
  it("cobre um ciclo completo: bazar, aventura e batalha", () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    for (const required of ["dice", "open-shop", "buy-card", "place-card", "adventure", "choose-bot", "battle"]) {
      expect(ids).toContain(required);
    }
  });

  it("começa e termina com passos de explicação (clique)", () => {
    expect(TUTORIAL_STEPS[0].done).toBeNull();
    expect(TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1].done).toBeNull();
  });

  it("todo passo de ação tem âncora para destacar", () => {
    for (const s of TUTORIAL_STEPS) {
      if (s.done !== null) {
        expect(s.anchors, `passo "${s.id}" automático precisa de âncora`).toBeTruthy();
        expect(s.anchors!.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("tutorial: condições de avanço", () => {
  it("rolar o dado avança o passo do dado", () => {
    expect(step("dice").done!(BASE)).toBe(false);
    expect(step("dice").done!({ ...BASE, hasRolled: true })).toBe(true);
  });

  it("abrir a loja avança o passo da loja", () => {
    expect(step("open-shop").done!(BASE)).toBe(false);
    expect(step("open-shop").done!({ ...BASE, shopOpen: true })).toBe(true);
  });

  it("comprar (carta na mão) avança o passo de compra", () => {
    expect(step("buy-card").done!(BASE)).toBe(false);
    expect(step("buy-card").done!({ ...BASE, handCount: 1 })).toBe(true);
  });

  it("posicionar no tabuleiro avança o passo de posicionamento", () => {
    expect(step("place-card").done!(BASE)).toBe(false);
    expect(step("place-card").done!({ ...BASE, slotsFilled: 1 })).toBe(true);
  });

  it("avançar para a aventura avança o passo AVANÇAR do bazar", () => {
    expect(step("advance-market").done!(BASE)).toBe(false);
    expect(step("advance-market").done!({ ...BASE, phase: "adventure" })).toBe(true);
  });

  it("escolher a recompensa avança o passo de aventura", () => {
    expect(step("adventure").done!({ ...BASE, phase: "adventure" })).toBe(false);
    expect(step("adventure").done!({ ...BASE, phase: "adventure", adventurePicked: true })).toBe(true);
  });

  it("iniciar a batalha avança o passo de escolha do bot", () => {
    expect(step("choose-bot").done!({ ...BASE, phase: "bot" })).toBe(false);
    expect(step("choose-bot").done!({ ...BASE, phase: "bot", battleActive: true })).toBe(true);
  });
});
