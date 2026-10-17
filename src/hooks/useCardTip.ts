"use client";

// Ligação das cartas com a dica flutuante (ver `CardTipHost`).
//
// Regras de interação:
//  - Hover sempre abre, sair fecha. Não filtra por `pointerType` aqui: em toque
//    o navegador também dispara pointerover no toque, e abrir a dica é o
//    comportamento certo. Filtrar quebraria em todo ambiente que não reporte
//    `pointerType` (jsdom nos testes, eventos sintéticos de teclado).
//  - Toque sem hover é coberto no `pointerdown`, para não depender do navegador
//    disparar pointerover. Só o mouse é ignorado ali, porque o hover acabou de
//    abrir e um toggle fecharia a dica no clique.

import { useCallback, type PointerEvent as ReactPointerEvent } from "react";
import { useGame } from "@/lib/store";
import type { CardInstance } from "@/lib/types";

export function useCardTip(card: CardInstance, opts?: { hideTier?: boolean }) {
  const open = useGame((s) => s.openCardTip);
  const close = useGame((s) => s.closeCardTip);
  const hideTier = opts?.hideTier;

  const onPointerEnter = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => open(card, e.currentTarget, hideTier),
    [card, open, hideTier],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse") return;
      open(card, e.currentTarget, hideTier);
    },
    [card, open, hideTier],
  );

  const onPointerLeave = useCallback(() => close(), [close]);

  return { onPointerEnter, onPointerDown, onPointerLeave };
}