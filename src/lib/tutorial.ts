// Roteiro do tutorial guiado ("APRENDER MAGGI"). Módulo isomórfico (sem
// "use client") para poder ser testado sem DOM: só descreve os passos e as
// condições de avanço. O componente TutorialOverlay interpreta este roteiro,
// desenha o spotlight bloqueante e a bolha de dica, e avança quando a condição
// de cada passo é satisfeita.
//
// Escopo (decidido com o jogador): um ciclo completo guiado — Bazar → Aventura
// → Batalha de bot. Ao fim, os tooltips somem e a run segue livre.

import type { Phase } from "./types";

/** Instantâneo do estado do jogo que as condições de avanço observam. */
export interface TutorialProgress {
  phase: Phase;
  hasRolled: boolean;
  shopOpen: boolean;
  handCount: number;
  slotsFilled: number;
  adventurePicked: boolean;
  battleActive: boolean;
}

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  /**
   * Seletores CSS cujos retângulos, unidos, formam o "buraco" iluminado e
   * clicável do spotlight. Vazio/omitido = passo central (tela escurecida
   * inteira, sem buraco), usado para explicações puras.
   */
  anchors?: string[];
  /**
   * Condição de avanço automático. `null` = passo manual: mostra o botão
   * CONTINUAR e só avança no clique. Função = avança sozinho quando ela retorna
   * verdadeiro (o jogador realizou a ação ensinada).
   */
  done: ((p: TutorialProgress) => boolean) | null;
  /** Rótulo do botão quando o passo é manual. */
  cta?: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "intro",
    title: "Bem-vindo ao MAGGI",
    body:
      "Vou te guiar por uma volta completa: comprar cartas no Bazar, pegar uma recompensa na Aventura e vencer uma batalha automática. Siga os destaques na tela.",
    done: null,
    cta: "COMEÇAR",
  },
  {
    id: "bazaar",
    title: "Fase do Bazar",
    body:
      "Aqui ficam os vendedores. É onde você monta sua build comprando cartas. Primeiro, você precisa de mana.",
    anchors: [".opponent-offers"],
    done: null,
  },
  {
    id: "dice",
    title: "Role o dado",
    body:
      "Clique (ou arraste) o dado para ganhar mana da rodada. Você sempre recebe uma base garantida, mais um bônus conforme o resultado.",
    anchors: [".dice-console"],
    done: (p) => p.hasRolled,
  },
  {
    id: "mana",
    title: "Sua mana",
    body:
      "Esta é a mana disponível nesta fase. Cada carta custa mana para ser comprada. Agora vamos gastar em uma carta.",
    anchors: [".mana-meter"],
    done: null,
  },
  {
    id: "open-shop",
    title: "Entre em uma loja",
    body:
      "Clique em um vendedor para ver as cartas que ele oferece. Cada vendedor é de um tipo: dano, cura, escudo ou aceleração.",
    anchors: [".opponent-offers"],
    done: (p) => p.shopOpen,
  },
  {
    id: "buy-card",
    title: "Compre uma carta",
    body:
      "Passe o mouse sobre uma carta para ver os detalhes. Para comprar, arraste a carta até a sua mão, no canto inferior direito.",
    anchors: [".opponent-offers", ".card-hand"],
    done: (p) => p.handCount > 0,
  },
  {
    id: "place-card",
    title: "Posicione no tabuleiro",
    body:
      "A carta está na sua mão. Arraste-a para um slot vazio do seu tabuleiro. Só cartas no tabuleiro lutam por você.",
    anchors: [".card-hand", ".board-row-player"],
    done: (p) => p.slotsFilled > 0,
  },
  {
    id: "advance-market",
    title: "Avance",
    body:
      "Quando terminar as compras, clique em AVANÇAR para seguir para a próxima fase.",
    anchors: [".phase-next:not(.phase-back)"],
    done: (p) => p.phase === "adventure",
  },
  {
    id: "adventure",
    title: "Fase de Aventura",
    body:
      "Entre as batalhas você escolhe UMA recompensa: uma carta forte, mais vida máxima ou um coringa para melhorar cartas. Escolha uma.",
    anchors: [".opponent-offers"],
    done: (p) => p.adventurePicked,
  },
  {
    id: "advance-adventure",
    title: "Rumo à batalha",
    body: "Pegou a recompensa? Clique em AVANÇAR para ir ao confronto.",
    anchors: [".phase-next:not(.phase-back)"],
    done: (p) => p.phase === "bot",
  },
  {
    id: "choose-bot",
    title: "Escolha o oponente",
    body:
      "Estes são bots para treinar. Perder para um bot NÃO encerra sua run. Escolha um para enfrentar.",
    anchors: [".opponent-offers"],
    done: (p) => p.battleActive,
  },
  {
    id: "battle",
    title: "Batalha automática",
    body:
      "A luta é automática! Suas cartas atacam sozinhas conforme o tempo de recarga de cada uma. Observe, aprenda e torça. É isso — você já sabe o essencial. Boa sorte na sua run!",
    done: null,
    cta: "ENTENDI, JOGAR!",
  },
];
