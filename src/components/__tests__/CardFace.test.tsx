// Regressões do redesign da carta (2026-10): arte como fundo, borda de 3px na
// cor do tier e selo de tier ao lado do custo.
//
// Bug introduzido na 1ª passada: o véu de legibilidade foi implementado em
// `.hand-card::after`, que JÁ era o brilho de hover da carta. Como as duas
// regras se fundem no mesmo pseudo-elemento, alater sobrescreveu o gradiente do
// brilho — e `.player-slot .hand-card::after { display: none }` desligava o véu
// justamente nas cartas do tabuleiro. O véu passou a ser um elemento próprio
// (`.card-scrim`).
//
// Regra: nenhum pseudo-elemento da carta pode ser reatribuído. ::after da carta
// é brilho de hover, ::before/::after da arte são cooldown, ::after de .video-card
// não existe mais (virou o véu comum). O véu é sempre `.card-scrim`.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, fireEvent } from "@testing-library/react";
import CardFace from "../CardFace";
import type { CardDef, CardInstance } from "@/lib/types";

const CSS = readFileSync(path.resolve(__dirname, "../../../app/globals.css"), "utf-8");

/** Extrai o corpo de uma regra `seletor { ... }` de topo. */
function ruleBody(selector: string, css = CSS): string {
  const re = new RegExp(`(?:^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "m");
  const match = re.exec(css);
  expect(match, `regra "${selector}" não encontrada em globals.css`).toBeTruthy();
  return match![1];
}

function card(over: Partial<CardDef> = {}): CardInstance {
  return {
    id: "card-1",
    // `tier` é o índice numérico (0=D .. 5=SS), não a letra.
    tier: 1, // C
    art: { kind: "image", src: "/art/starfall.png" },
    def: {
      id: "starfall",
      name: "STARFALL",
      kind: "spell",
      cost: 2,
      cooldown: 2,
      effectType: "damage",
      effectValue: 3,
      description: "estrelas",
      ...over,
    },
  };
}

describe("CardFace: arte como fundo", () => {
  it("renderiza a arte e o véu como camadas separadas da carta", () => {
    const { container } = render(<CardFace card={card()} context="slot" />);
    const art = container.querySelector(".hand-card > .card-art");
    const scrim = container.querySelector(".hand-card > .card-scrim");

    expect(art, "a arte precisa existir para virar o fundo").toBeTruthy();
    expect(scrim, "o véu precisa ser elemento próprio, não pseudo-elemento").toBeTruthy();
  });

  it("o véu fica acima da arte e abaixo do texto", () => {
    const art = ruleBody(".card-art");
    const scrim = ruleBody(".card-scrim");
    const header = ruleBody(".card-header");
    const z = (corpo: string) => Number(/z-index:\s*(\d+)/.exec(corpo)?.[1]);

    expect(z(art), "arte no fundo").toBe(0);
    expect(z(scrim), "véu sobre a arte").toBeGreaterThan(z(art));
    expect(z(header), "texto sobre o véu").toBeGreaterThan(z(scrim));
  });

  it("a arte é absoluto e a carta isola o empilhamento", () => {
    const art = ruleBody(".card-art");
    const card = ruleBody(".hand-card");

    expect(art).toMatch(/position:\s*absolute/);
    expect(art).toMatch(/inset:\s*0/);
    expect(card).toMatch(/isolation:\s*isolate/);
    // Sem arte, o gradiente de tier continua visível como fundo de reserva.
    expect(art).toMatch(/background:\s*var\(--card-background\)/);
  });
});

describe("CardFace: performance — vídeo não toca parado", () => {
  // Regressão (2026-10): TODA carta de arte em vídeo renderizava um
  // `<video autoplay loop>`. Em batalha/loja/grade de deck isso são dezenas de
  // vídeos decodificando ao mesmo tempo — a causa principal da lentidão geral.
  // Parada, a carta mostra o pôster (quadro estático); o vídeo só entra no hover.
  const videoCard = (): CardInstance => ({
    id: "card-v",
    tier: 1,
    art: { kind: "video", src: "/art/clip.mp4", poster: "/art/clip.jpg" },
    def: {
      id: "bolt",
      name: "BOLT",
      kind: "spell",
      cost: 2,
      cooldown: 2,
      effectType: "damage",
      effectValue: 3,
      description: "raio",
    },
  });

  it("parada, mostra o pôster e NÃO monta vídeo", () => {
    const { container } = render(<CardFace card={videoCard()} context="combat" />);
    expect(container.querySelector(".card-art video"), "não pode haver vídeo tocando parado").toBeNull();
    const img = container.querySelector<HTMLImageElement>(".card-art img");
    expect(img, "deve mostrar o pôster como imagem estática").toBeTruthy();
    expect(img!.getAttribute("src")).toBe("/art/clip.jpg");
  });

  it("no hover, monta o vídeo animado", () => {
    const { container } = render(<CardFace card={videoCard()} context="hand" />);
    fireEvent.pointerEnter(container.querySelector(".hand-card")!);
    expect(container.querySelector(".card-art video"), "o vídeo entra no hover").toBeTruthy();
  });

  it("ao sair do hover, volta para o pôster (libera o decoder)", () => {
    const { container } = render(<CardFace card={videoCard()} context="hand" />);
    const el = container.querySelector(".hand-card")!;
    fireEvent.pointerEnter(el);
    fireEvent.pointerLeave(el);
    expect(container.querySelector(".card-art video")).toBeNull();
    expect(container.querySelector(".card-art img")).toBeTruthy();
  });
});

describe("CardFace: borda e selo de tier", () => {
  it("a borda da carta tem 3px na cor do tier", () => {
    expect(ruleBody(".hand-card")).toMatch(/border:\s*3px solid var\(--card-accent/);
  });

  it("o selo de tier fica ao lado do custo, no mesmo agrupamento", () => {
    const { container } = render(<CardFace card={card()} context="slot" />);
    const topright = container.querySelector(".card-header > .card-topright");

    expect(topright, "custo e tier precisam ficar agrupados no topo direito").toBeTruthy();
    expect(topright!.querySelector(".card-cost"), "custo presente").toBeTruthy();
    expect(
      topright!.querySelector(".card-tier-badge"),
      "selo de tier dentro do agrupamento do custo",
    ).toBeTruthy();
    expect(topright!.textContent).toContain("C");
  });

  it("o selo da carta sai do posicionamento absoluto (o da loja não)", () => {
    // A classe base é absoluta porque `.offer-tile` tem markup próprio e depende
    // disso; dentro do cabeçalho da carta é o escopo `.card-topright` que tira
    // do fluxo.
    expect(ruleBody(".card-topright .card-tier-badge")).not.toMatch(/position:\s*absolute/);
    expect(ruleBody(".card-topright .card-tier-badge")).toMatch(/position:\s*static/);
  });

  it("o selo da loja continua absoluto", () => {
    // Regressão: ao tirar o `position: absolute` da classe base, o "D" da
    // `.offer-tile` voltou para o fluxo e empurrou o layout do tile.
    expect(ruleBody(".card-tier-badge")).toMatch(/position:\s*absolute/);
  });

  it("a prévia de design não mostra o selo nem a borda de tier", () => {
    const { container } = render(<CardFace card={card()} context="preview" />);
    expect(container.querySelector(".card-tier-badge")).toBeNull();
    expect(container.querySelector(".card-design-preview")).toBeTruthy();
  });
});

describe("CSS da carta: pseudo-elementos não podem ser reatribuídos", () => {
  it("`.hand-card::after` continua sendo o brilho de hover", () => {
    const brilho = ruleBody(".hand-card::after");
    expect(brilho).toMatch(/linear-gradient\(135deg/);
    expect(brilho).toMatch(/opacity:\s*0/);
    // Um véu aqui escureceria a carta inteira e o brilho sumiria.
    expect(brilho).not.toMatch(/rgba\(5,\s*9,\s*17/);
  });

  it("`.card-art::before/::after` continuam sendo o cooldown", () => {
    expect(ruleBody(".card-art::before")).toMatch(/--cooldown-progress/);
    expect(ruleBody(".card-art::after")).toMatch(/--cooldown-progress/);
  });

  it("o efeito prismático é elemento próprio (.card-prism), não pseudo de .card-art", () => {
    // Regressão (2026-10): o prismático foi implementado em `.card-art::after`,
    // que JÁ é o cooldown — as duas regras colidiam no mesmo pseudo.
    expect(ruleBody(".card-prism")).toMatch(/prismatic-rotate/);
    // Só regras de TOPO (seletor `.card-art::after` sozinho), ignorando os
    // seletores descendentes do cooldown como `.board-row ... .card-art::after`.
    const ocorrencias = (CSS.match(/(?:^|\})\s*\.card-art::after\s*\{/gm) ?? []).length;
    expect(ocorrencias, "só o cooldown pode definir .card-art::after de topo").toBe(1);
  });

  it("a carta renderiza o prismático dentro da arte", () => {
    const { container } = render(<CardFace card={card()} context="slot" />);
    expect(container.querySelector(".card-art > .card-prism")).toBeTruthy();
  });

  it("`.card-scrim` é quem carrega o véu escuro", () => {
    expect(ruleBody(".card-scrim")).toMatch(/rgba\(5,\s*9,\s*17/);
  });

  it("`.video-card` não tem véu próprio (duplicaria o escurecimento)", () => {
    // Só o fundo de reserva e o enquadramento do vídeo; o véu é o comum.
    expect(CSS).not.toMatch(/\.video-card::before/);
  });
});

describe("CSS: dica flutuante mantém a setinha", () => {
  it("o balão no portal continua com o triângulo (::after)", () => {
    // Regressão (2026-10): o balão flutuante tinha `content: none` no ::after,
    // sumindo com a setinha que simula a seta apontando para a carta.
    const arrow = ruleBody(".card-tip-shell .card-tip::after");
    expect(arrow, "a setinha precisa existir no balão do portal").toMatch(/content:\s*""/);
    expect(arrow, "não pode voltar a ser desligada").not.toMatch(/content:\s*none/);
  });

  it("a casca centra o balão no meio da âncora", () => {
    // `placeTip` devolve o centro; sem translateX(-50%) o balão sai para o lado.
    expect(ruleBody(".card-tip-shell")).toMatch(/transform:\s*translateX\(-50%\)/);
  });

  it("quando o balão fica abaixo, a seta vira para cima", () => {
    // Regressão (2026-10): a seta ficava sempre apontando para baixo, mesmo com
    // o balão abaixo da carta. Com data-placement=below ela sobe (bottom:100%)
    // e troca a cor da borda (border-bottom em vez de border-top).
    const below = ruleBody('.card-tip-shell[data-placement="below"] .card-tip::after');
    expect(below).toMatch(/bottom:\s*100%/);
    expect(below).toMatch(/border-top-color:\s*transparent/);
    expect(below).toMatch(/border-bottom-color:/);
  });
});

describe("CSS: cursor único do app", () => {
  it("declara a seta customizada em --app-cursor", () => {
    expect(CSS).toMatch(/--app-cursor:\s*url\("\/cursors\/game-cursor-48\.png"\)/);
  });

  it("aplica o cursor a todos os elementos (!important)", () => {
    expect(CSS).toMatch(
      /\*,\s*\*::before,\s*\*::after\s*\{[^}]*cursor:\s*var\(--app-cursor\)\s*!important/,
    );
  });
});

describe("CSS: cartas do jogador na mesma escala do bot", () => {
  // Regressão (2026-10): o tabuleiro do bot compacta fonte/espaçamento via
  // `.is-combat-board`, mas o do jogador não — as cartas ficavam maiores. O
  // tabuleiro do jogador precisa repetir a mesma escala.
  it(".board-row-player repete a compactação de fonte do .is-combat-board", () => {
    expect(ruleBody(".board-row-player .card-header")).toMatch(/font-size/);
    expect(ruleBody(".board-row-player .card-type")).toMatch(/font-size/);
    expect(ruleBody(".board-row-player .card-stats")).toMatch(/font-size/);
    expect(ruleBody(".board-row-player .card-cost")).toMatch(/font-size/);
  });
});