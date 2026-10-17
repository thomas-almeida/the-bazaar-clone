// Regressões da criação de carta pelo painel (2026-10).
//
// O id da carta precisa casar com a constraint do banco (`^[a-z0-9-]+$`) e com
// `isCardDefinition`. O slug deriva do nome; a carta em branco criada pelo
// painel tem que ser válida de cara.

import { describe, expect, it } from "vitest";
import { slugifyCardId, isCardDefinition } from "@/lib/admin-cards";
import type { CardDef } from "@/lib/types";

describe("slugifyCardId", () => {
  it("minúsculas, hífens e sem acentos", () => {
    expect(slugifyCardId("Fogo Fátuo")).toBe("fogo-fatuo");
    expect(slugifyCardId("Coração de Gelo")).toBe("coracao-de-gelo");
  });

  it("colapsa separadores e apara as pontas", () => {
    expect(slugifyCardId("  --Hello   World!!  ")).toBe("hello-world");
    expect(slugifyCardId("A___B")).toBe("a-b");
  });

  it("devolve vazio quando não sobra nada válido", () => {
    expect(slugifyCardId("###")).toBe("");
    expect(slugifyCardId("   ")).toBe("");
  });

  it("gera sempre um id aceito pela constraint do banco", () => {
    const id = slugifyCardId("Égide da Tempestade 2!");
    expect(id).toBe("egide-da-tempestade-2");
    expect(/^[a-z0-9-]+$/.test(id)).toBe(true);
  });

  it("limita o tamanho a 60", () => {
    expect(slugifyCardId("a".repeat(100)).length).toBe(60);
  });
});

describe("carta em branco do painel é válida", () => {
  function blank(name: string): CardDef {
    return {
      id: slugifyCardId(name),
      name,
      kind: "spell",
      cost: 1,
      cooldown: 2,
      effectType: "damage",
      effectValue: 1,
      description: "",
    };
  }

  it("passa em isCardDefinition com o id derivado do nome", () => {
    const card = blank("Nova Carta");
    expect(card.id).toBe("nova-carta");
    expect(isCardDefinition(card, card.id)).toBe(true);
  });

  it("rejeita id fora do padrão (ex.: maiúsculas)", () => {
    const card = { ...blank("x"), id: "NOVA" };
    expect(isCardDefinition(card, "NOVA")).toBe(false);
  });
});
