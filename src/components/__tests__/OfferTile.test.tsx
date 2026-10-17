// Regressões da oferta de loja (2026-10).
//
// Mudança: a oferta do bazar passou a usar o design normal de carta
// (`CardFace`), não mais o mini-tile `.offer-tile`. Os detalhes saem na dica
// flutuante (hover/toque).
//
// Bug introduzido nessa passada: como a oferta virou um `.hand-card`, o preview
// de arrasto (clone com `.offer-drag-preview`, especificidade (0,1,0)) PERDIA
// na cascata para o `transform` da base `.hand-card` (0,1,0, porém declarada
// depois no arquivo). A carta arrastada parava de seguir o ponteiro. A correção
// reusa a classe `.drag-preview` (regra `.hand-card.drag-preview`, (0,2,0)), que
// vence a base por especificidade independentemente da ordem.
//
// Regra travada aqui:
//  - a oferta renderiza um CardFace (sem o markup antigo do tile);
//  - arrastar cria um preview `.hand-card.drag-preview` que segue o ponteiro;
//  - soltar sobre a mão compra;
//  - nenhuma regra de preview pode ter seletor de classe única (perderia a
//    cascata para `.hand-card`).

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, fireEvent, cleanup } from "@testing-library/react";

// jsdom não implementa PointerEvent, então `fireEvent.pointer*` não entrega
// clientX (o cálculo do limiar de arrasto viraria NaN). Um MouseEvent com o
// tipo do evento de ponteiro carrega clientX/button e dispara os mesmos
// listeners (`pointerdown`/`pointermove`/`pointerup`). `pointerId` fica
// undefined de ponta a ponta, o que o código tolera.
function pointer(
  target: Element | Document,
  type: "pointerdown" | "pointermove" | "pointerup",
  init: { clientX: number; clientY: number; button?: number },
) {
  fireEvent(
    target,
    new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init }),
  );
}
import OfferTile from "../OfferTile";
import { useGame } from "@/lib/store";
import type { CardInstance } from "@/lib/types";

const CSS = readFileSync(path.resolve(__dirname, "../../../app/globals.css"), "utf-8");

/** Extrai o corpo de uma regra `seletor { ... }` de topo. */
function ruleBody(selector: string, css = CSS): string {
  const re = new RegExp(`(?:^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "m");
  const match = re.exec(css);
  expect(match, `regra "${selector}" não encontrada em globals.css`).toBeTruthy();
  return match![1];
}

function offer(): CardInstance {
  return {
    id: "offer-1",
    tier: 0, // D
    art: { kind: "image", src: "/art/x.png" },
    def: {
      id: "starfall",
      name: "STARFALL",
      kind: "spell",
      cost: 2,
      cooldown: 2,
      effectType: "damage",
      effectValue: 3,
      description: "chuva de estrelas",
    },
  };
}

/** Coloca o store numa fase de mercado onde a oferta é comprável. */
function marketState(over: Partial<ReturnType<typeof useGame.getState>> = {}) {
  useGame.setState({
    phase: "market",
    mana: 999,
    hand: [],
    cardTip: null,
    config: { ...useGame.getState().config, infiniteMana: true, shopTestPrice: 1, maxHandSize: 10 },
    ...over,
  });
}

/** Mão com rect grande, para o teste de "soltar sobre a mão". */
function fakeHand(): HTMLElement {
  const hand = document.createElement("div");
  hand.className = "card-hand";
  hand.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 1000, bottom: 1000, width: 1000, height: 1000, x: 0, y: 0, toJSON() {} }) as DOMRect;
  document.body.appendChild(hand);
  return hand;
}

afterEach(() => {
  cleanup();
  document.querySelectorAll(".card-hand, .drag-preview").forEach((n) => n.remove());
  document.body.classList.remove("dragging");
});

beforeEach(() => {
  useGame.setState({ cardTip: null });
});

describe("OfferTile: design normal de carta", () => {
  it("renderiza um CardFace, sem o mini-tile antigo", () => {
    marketState();
    const { container } = render(<OfferTile offer={offer()} />);

    expect(container.querySelector(".hand-card"), "a oferta é um CardFace").toBeTruthy();
    expect(container.querySelector(".offer-tile-name"), "markup antigo do tile não deve existir").toBeNull();
    expect(container.querySelector(".offer-tile-details")).toBeNull();
    expect(container.querySelector(".card-topright .card-cost"), "custo no topo direito").toBeTruthy();
    expect(container.textContent).toContain("STARFALL");
  });
});

describe("OfferTile: arrasto para comprar", () => {
  it("arrastar cria um preview .hand-card.drag-preview que segue o ponteiro", () => {
    marketState();
    const { container } = render(<OfferTile offer={offer()} />);
    const el = container.querySelector(".hand-card") as HTMLElement;

    pointer(el, "pointerdown", { clientX: 10, clientY: 10 });
    pointer(document, "pointermove", { clientX: 60, clientY: 60 }); // > 6px: inicia o arrasto

    const preview = document.querySelector(".hand-card.drag-preview") as HTMLElement | null;
    expect(preview, "o preview precisa ser um clone .hand-card.drag-preview").toBeTruthy();
    expect(el.classList.contains("is-dragging-source"), "a origem marca que está sendo arrastada").toBe(true);
    // O preview segue o ponteiro pelas variáveis --drag-x/--drag-y.
    expect(preview!.style.getPropertyValue("--drag-x")).not.toBe("");
    expect(preview!.style.getPropertyValue("--drag-y")).not.toBe("");
  });

  it("soltar sobre a mão compra a oferta e remove o preview", () => {
    const buyOffer = vi.fn();
    marketState({ buyOffer });
    fakeHand();
    const { container } = render(<OfferTile offer={offer()} />);
    const el = container.querySelector(".hand-card") as HTMLElement;

    pointer(el, "pointerdown", { clientX: 10, clientY: 10 });
    pointer(document, "pointermove", { clientX: 500, clientY: 500 });
    pointer(document, "pointerup", { clientX: 500, clientY: 500 });

    expect(buyOffer, "soltar na mão compra").toHaveBeenCalledWith("offer-1");
    expect(document.querySelector(".drag-preview"), "o preview é removido ao soltar").toBeNull();
    expect(el.classList.contains("is-dragging-source")).toBe(false);
  });

  it("não compra se soltar fora da mão", () => {
    const buyOffer = vi.fn();
    marketState({ buyOffer });
    fakeHand();
    const { container } = render(<OfferTile offer={offer()} />);
    const el = container.querySelector(".hand-card") as HTMLElement;

    pointer(el, "pointerdown", { clientX: 10, clientY: 10 });
    pointer(document, "pointermove", { clientX: 60, clientY: 60 });
    pointer(document, "pointerup", { clientX: 2000, clientY: 2000 }); // longe da mão

    expect(buyOffer).not.toHaveBeenCalled();
    expect(document.querySelector(".drag-preview")).toBeNull();
  });
});

describe("CSS: o preview de arrasto vence a cascata da base .hand-card", () => {
  it(".hand-card.drag-preview é compound (0,2,0) e carrega o transform de arrasto", () => {
    const base = ruleBody(".hand-card");
    const preview = ruleBody(".hand-card.drag-preview");
    // Se a base não tivesse transform próprio, não haveria conflito a resolver.
    expect(base, "a base .hand-card define transform").toMatch(/transform:/);
    expect(preview, "o preview move pelo translate3d das vars de arrasto").toMatch(
      /transform:\s*translate3d\(var\(--drag-x\)/,
    );
    expect(preview).toMatch(/position:\s*fixed\s*!important/);
  });

  it("não existe mais regra de preview com seletor de classe única", () => {
    // `.offer-drag-preview` (0,1,0) perdia para `.hand-card` (0,1,0) por ordem.
    expect(CSS, "a antiga .offer-drag-preview não pode voltar").not.toMatch(/\.offer-drag-preview\s*\{/);
  });
});
