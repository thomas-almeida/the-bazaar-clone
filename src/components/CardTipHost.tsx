"use client";

// Host único da dica de carta em jogo. Substitui o antigo CardModal.
//
// Por que portal: `.hand-card` tem `overflow: hidden` e as cartas são
// posicionadas por `--card-index`/`--card-angle` dentro de contêineres cuja
// geometria está aprovada. Um tooltip dentro da carta seria cortado, e um
// wrapper em volta da carta mudaria a âncora do posicionamento. Então a dica é
// renderizada em `document.body` com `position: fixed`, calculada a partir do
// `getBoundingClientRect()` da âncora.
//
// Mouse abre no hover. Toque não tem hover: abrimos no `pointerdown` e
// fechamos quando o próximo toque cai fora da carta.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CardTooltip from "./CardTooltip";
import SellerTooltip from "./SellerTooltip";
import { useGame } from "@/lib/store";

const GAP = 10;
const EDGE = 8;
const TIP_WIDTH = 272;

export interface TipPlacement {
  left: number;
  top: number;
  /** Lado em que o balão ficou em relação à âncora — define a seta. */
  placement: "above" | "below";
}

/**
 * Posiciona a dica: acima da carta se couber, abaixo se não couber, sempre
 * presa dentro da janela na horizontal.
 *
 * Exportada para ser testada — o cálculo depende da altura real do balão, que
 * só existe depois do render.
 */
export function placeTip(
  anchor: { left: number; top: number; right: number; bottom: number; width: number },
  tip: { width: number; height: number },
  view: { width: number; height: number },
): TipPlacement {
  const half = tip.width / 2;
  const left = Math.min(
    Math.max(anchor.left + anchor.width / 2, half + EDGE),
    Math.max(half + EDGE, view.width - half - EDGE),
  );
  const above = anchor.top - GAP - tip.height;
  const fitsAbove = above >= EDGE;
  const top = fitsAbove ? above : Math.min(anchor.bottom + GAP, view.height - tip.height - EDGE);
  return { left, top, placement: fitsAbove ? "above" : "below" };
}

export default function CardTipHost() {
  const cardTip = useGame((s) => s.cardTip);
  const sellerTip = useGame((s) => s.sellerTip);
  const closeCard = useGame((s) => s.closeCardTip);
  const closeSeller = useGame((s) => s.closeSellerTip);
  // Uma dica ativa por vez; a carta tem prioridade. Os efeitos dependem da
  // âncora (nó DOM estável vindo do store), nunca de um objeto recriado a cada
  // render — senão o `setPos` reinicia o layoutEffect em laço.
  const anchor = cardTip?.anchor ?? sellerTip?.anchor ?? null;
  const close = cardTip ? closeCard : closeSeller;
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<TipPlacement | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Escape fecha.
  useEffect(() => {
    if (!anchor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchor, close]);

  // Toque fora da carta fecha. Sem isso a dica ficaria presa na tela, já que em
  // touch não existe "sair da carta".
  useEffect(() => {
    if (!anchor) return;
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && (anchor.contains(e.target) || e.pointerType === "mouse")) {
        return;
      }
      close();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [anchor, close]);

  // Posiciona e reposiciona em scroll/resize, porque a âncora é um elemento
  // real, não coordenadas fixas.
  //
  // O effect NÃO pode depender de `pos`: ele roda no layoutEffect, ou seja,
  // ANTES de o `pos` existir, e nesse momento é a primeira montagem do shell.
  // Por isso o shell é renderizado desde o começo (mesmo sem `pos`) — assim o
  // `nodeRef` já tem altura neste mesmo passo. Bug anterior: o host devolvia
  // `null` enquanto não havia `pos`, media `height = 0` e a dica ficava
  // sobrepondo a carta, sem nunca se corrigir.
  useLayoutEffect(() => {
    if (!anchor) {
      setPos(null);
      return;
    }
    const place = () => {
      // A carta pode ter sido movida entre zonas (mão → tabuleiro) e não estar
      // mais no DOM: nesse caso a dica não tem âncora e some.
      if (!anchor.isConnected) {
        close();
        return;
      }
      const node = nodeRef.current;
      setPos(
        placeTip(
          anchor.getBoundingClientRect(),
          { width: node?.offsetWidth || TIP_WIDTH, height: node?.offsetHeight || 0 },
          { width: window.innerWidth, height: window.innerHeight },
        ),
      );
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchor, close]);

  if (!mounted || !anchor) return null;

  // A casca só posiciona; quem carrega o visual e o `--tip-accent` é a raiz do
  // próprio CardTooltip (`.card-tip`), redefinida como estática dentro daqui.
  return createPortal(
    <div
      ref={nodeRef}
      className="card-tip-shell"
      data-placement={pos?.placement ?? "above"}
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0 }}
    >
      {cardTip ? (
        <CardTooltip card={cardTip.card} hideTier={cardTip.hideTier} />
      ) : sellerTip ? (
        <SellerTooltip seller={sellerTip.seller} />
      ) : null}
    </div>,
    document.body,
  );
}