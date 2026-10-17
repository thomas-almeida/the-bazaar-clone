// Regressões da dica flutuante de carta (2026-10), que substituiu o CardModal.
//
// O que fica travado aqui:
//  - o estado `cardTip` guarda a ÂNCORA (elemento DOM), não coordenadas: a
//    carta tem `overflow: hidden` e o balão vive em `document.body`;
//  - mouse abre no hover e fecha ao sair; toque abre no `pointerdown` (e não no
//    hover, senão no desktop o clique viraria "abre e Fecha");
//  - sem `slot` a dica é a carta viva: nada de "SLOT n" nem do rodapé de run.
//
// Regra: o evento de som continua `event:cardModal`. O id não pode mudar — é o
// que os patches de áudio já gravaram no banco.

import CardTipHost, { placeTip } from "../CardTipHost";
import { describe, expect, it, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { useGame } from "@/lib/store";
import { useCardTip } from "@/hooks/useCardTip";
import CardTooltip from "../CardTooltip";
import type { CardInstance } from "@/lib/types";

function card(): CardInstance {
  return {
    id: "card-1",
    tier: 2, // B
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

/** Carta de teste que liga a dica pelos handlers do hook. */
function Probe({ c }: { c: CardInstance }) {
  const tip = useCardTip(c);
  return (
    <button type="button" data-testid="carta" {...tip}>
      {c.def.name}
    </button>
  );
}

/** Anchor falso para testes de placeTip. */
function fakeAnchor(left = 400, top = 300, width = 120, bottom = 500) {
  return { left, top, right: left + width, bottom, width };
}

beforeEach(() => {
  useGame.setState({ cardTip: null });
});

describe("store: cardTip", () => {
  it("guarda a carta junto com a âncora", () => {
    const c = card();
    const anchor = document.createElement("article");
    useGame.getState().openCardTip(c, anchor);

    expect(useGame.getState().cardTip).toEqual({ card: c, anchor });
  });

  it("closeCardTip limpa", () => {
    useGame.getState().openCardTip(card(), document.createElement("article"));
    useGame.getState().closeCardTip();
    expect(useGame.getState().cardTip).toBeNull();
  });

  it("guarda hideTier quando pedido (telas de magos/decks)", () => {
    const c = card();
    const anchor = document.createElement("article");
    useGame.getState().openCardTip(c, anchor, true);
    expect(useGame.getState().cardTip?.hideTier).toBe(true);
  });

  it("não existe mais estado de modal de carta", () => {
    const s = useGame.getState() as unknown as Record<string, unknown>;
    expect(s.modalCard, "modalCard deve ter sumido").toBeUndefined();
    expect(s.openModal).toBeUndefined();
    expect(s.closeModal).toBeUndefined();
  });
});

describe("useCardTip: hover e toque", () => {
  it("hover abre e sair fecha", () => {
    render(<Probe c={card()} />);
    const el = screen.getByTestId("carta");

    fireEvent.pointerOver(el);
    expect(useGame.getState().cardTip?.anchor).toBe(el);

    fireEvent.pointerOut(el);
    expect(useGame.getState().cardTip).toBeNull();
  });

  it("hover abre mesmo sem pointerType (jsdom entrega undefined)", () => {
    render(<Probe c={card()} />);
    fireEvent.pointerOver(screen.getByTestId("carta"));
    expect(useGame.getState().cardTip).not.toBeNull();
  });

  it("toque abre no pointerdown", () => {
    render(<Probe c={card()} />);
    const el = screen.getByTestId("carta");

    const el2 = screen.getByTestId("carta");
    const ev = new Event("pointerdown", { bubbles: true, cancelable: true });
    (ev as unknown as { pointerType: string }).pointerType = "touch";
    fireEvent.pointerDown(el2, ev);
    expect(useGame.getState().cardTip?.anchor).toBe(el2);
  });

  it("pointerdown de mouse não mexe na dica que o hover abriu", () => {
    render(<Probe c={card()} />);
    const el = screen.getByTestId("carta");

    fireEvent.pointerOver(el);
    const ev = new Event("pointerdown", { bubbles: true, cancelable: true });
    (ev as unknown as { pointerType: string }).pointerType = "mouse";
    fireEvent.pointerDown(el, ev);
    expect(useGame.getState().cardTip?.anchor).toBe(el);
  });
});

describe("CardTooltip: tier opcional", () => {
  it("mostra o tier por padrão", () => {
    const { container } = render(<CardTooltip card={card()} />);
    expect(container.querySelector(".card-tip-tier"), "tier visível por padrão").toBeTruthy();
  });

  it("oculta o tier com hideTier (telas sem tier)", () => {
    const { container } = render(<CardTooltip card={card()} hideTier />);
    expect(container.querySelector(".card-tip-tier"), "tier não deve aparecer").toBeNull();
    // O nome continua presente — só o "D · BRONZE" some.
    expect(container.textContent).toContain("STARFALL");
  });
});

describe("placeTip: matemática da posição", () => {
  const VIEW = { width: 1000, height: 700 };
  const TIP = { width: 272, height: 120 };

  it("coloca acima da carta quando cabe", () => {
    const { top, placement } = placeTip(fakeAnchor(), TIP, VIEW);
    expect(top).toBe(fakeAnchor().top - 10 - TIP.height);
    expect(top + TIP.height).toBeLessThanOrEqual(fakeAnchor().top);
    expect(placement, "balão acima → seta aponta para baixo").toBe("above");
  });

  it("desce para baixo quando não cabe acima", () => {
    const noTopo = { ...fakeAnchor(), top: 10, bottom: 210 };
    const { top, placement } = placeTip(noTopo, TIP, VIEW);
    expect(top).toBe(noTopo.bottom + 10);
    // Regressão (2026-10): quando o balão fica abaixo, a seta precisa apontar
    // para CIMA — o placement informa isso à casca via data-placement.
    expect(placement, "balão abaixo → seta aponta para cima").toBe("below");
  });

  it("nunca deixa a dica fora da janela", () => {
    const noTopo = { ...fakeAnchor(), top: 10, bottom: 210 };
    const abaixo = placeTip(noTopo, TIP, VIEW).top;
    expect(abaixo + TIP.height).toBeLessThanOrEqual(VIEW.height);
  });

  it("centraliza na carta", () => {
    expect(placeTip(fakeAnchor(), TIP, VIEW).left).toBe(fakeAnchor().left + fakeAnchor().width / 2);
  });

  it("prende a dica dentro da janela na horizontal", () => {
    const esquerda = { ...fakeAnchor(), left: 0, width: 40 };
    const dir = { ...fakeAnchor(), left: 940, width: 40 };
    expect(placeTip(esquerda, TIP, VIEW).left).toBe(TIP.width / 2 + 8);
    expect(placeTip(dir, TIP, VIEW).left).toBe(VIEW.width - TIP.width / 2 - 8);
  });

  it("com altura 0 devolve o topo da carta", () => {
    const { top } = placeTip(fakeAnchor(), { width: 272, height: 0 }, VIEW);
    expect(top).toBe(fakeAnchor().top - 10);
  });
});