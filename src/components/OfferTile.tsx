"use client";

// Oferta do bazar. Clique abre os detalhes; arrastar até a mão compra.
// Porta de createOfferTile + setupOfferDragging de board.js.

import { useEffect, useRef } from "react";
import { useGame } from "@/lib/store";
import { useCardTip } from "@/hooks/useCardTip";
import CardFace from "./CardFace";
import type { CardInstance } from "@/lib/types";

export default function OfferTile({ offer }: { offer: CardInstance }) {
  const ref = useRef<HTMLElement>(null);
  const canPurchase = useGame((s) => {
    const enough = s.config.infiniteMana || s.mana >= s.config.shopTestPrice;
    return s.phase === "market" && enough && s.hand.length < s.config.maxHandSize;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const hand = document.querySelector<HTMLElement>(".card-hand");
    type Drag = {
      pointerId: number;
      offsetX: number;
      offsetY: number;
      startX: number;
      startY: number;
      moved: boolean;
      preview: HTMLElement;
    };
    let drag: Drag | null = null;
    let suppressClick = false;

    const clearDrop = () => hand?.classList.remove("is-drop-target");
    const overHand = (x: number, y: number) => {
      if (!hand) return false;
      const b = hand.getBoundingClientRect();
      return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
    };

    const endDrag = (event: PointerEvent, shouldDrop: boolean) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dropped = shouldDrop && drag.moved && overHand(event.clientX, event.clientY);
      if (drag.moved && shouldDrop) suppressClick = true;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      document.body.classList.remove("dragging");
      clearDrop();
      drag.preview.remove();
      el.classList.remove("is-dragging-source");
      drag = null;
      if (dropped) useGame.getState().buyOffer(offer.id);
    };

    const onMove = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (!drag.moved) {
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
        drag.moved = true;
        el.classList.add("is-dragging-source");
        document.body.classList.add("dragging");
      }
      event.preventDefault();
      drag.preview.style.setProperty("--drag-x", `${event.clientX - drag.offsetX}px`);
      drag.preview.style.setProperty("--drag-y", `${event.clientY - drag.offsetY}px`);
      hand?.classList.toggle("is-drop-target", overHand(event.clientX, event.clientY));
    };
    const onUp = (event: PointerEvent) => endDrag(event, true);
    const onCancel = (event: PointerEvent) => endDrag(event, false);

    const onDown = (event: PointerEvent) => {
      const s = useGame.getState();
      const purchasable =
        s.phase === "market" &&
        (s.config.infiniteMana || s.mana >= s.config.shopTestPrice) &&
        s.hand.length < s.config.maxHandSize;
      if (event.button !== 0 || !purchasable) return;
      const bounds = el.getBoundingClientRect();
      const preview = el.cloneNode(true) as HTMLElement;
      preview.classList.remove("is-dragging-source");
      // A oferta agora é um `.hand-card` (CardFace). O preview reusa a classe
      // `.drag-preview` (regra `.hand-card.drag-preview`), cuja especificidade
      // (0,2,0) vence o `transform` da base `.hand-card` — senão a carta
      // arrastada não segue o ponteiro.
      preview.classList.add("drag-preview");
      preview.style.width = `${bounds.width}px`;
      preview.style.height = `${bounds.height}px`;
      preview.style.setProperty("--drag-x", `${bounds.left}px`);
      preview.style.setProperty("--drag-y", `${bounds.top}px`);
      document.body.append(preview);
      drag = {
        pointerId: event.pointerId,
        offsetX: event.clientX - bounds.left,
        offsetY: event.clientY - bounds.top,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        preview,
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onCancel);
    };

    // O clique não abre mais nada: arrastar até a mão continua comprando, e os
    // detalhes saem na dica flutuante (hover/toque).
    const onClick = () => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      useGame.getState().closeCardTip();
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("click", onClick);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      drag?.preview.remove();
    };
  }, [offer]);

  const { def } = offer;
  const tipHandlers = useCardTip(offer);

  // Carta de loja com o design normal (CardFace). Os detalhes saem na dica
  // flutuante (hover/toque); arrastar até a mão continua comprando.
  return (
    <CardFace
      card={offer}
      context="hand"
      innerRef={ref}
      extraClass={`offer-card ${canPurchase ? "is-purchasable is-draggable" : "is-unavailable"}`}
      onPointerEnter={tipHandlers.onPointerEnter}
      onPointerDown={tipHandlers.onPointerDown}
      onPointerLeave={tipHandlers.onPointerLeave}
    />
  );
}
