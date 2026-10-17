"use client";

// Carta invocada num slot do tabuleiro. Fora de batalha pode ser arrastada de
// volta para a mão (desfaz a invocação). Clique aplica coringa armado; os
// detalhes saem na dica flutuante (hover/toque). Durante o combate fica
// estática.

import { useEffect, useMemo, useRef } from "react";
import { useGame } from "@/lib/store";
import { computeSynergy, NO_BONUS } from "@/lib/synergy";
import { playerPassiveMods } from "@/lib/passives";
import type { CardInstance } from "@/lib/types";
import CardFace from "./CardFace";
import { useCardTip } from "@/hooks/useCardTip";
import { playEvent } from "@/lib/sfx";

export default function SlotCard({ card, index }: { card: CardInstance; index: number }) {
  const ref = useRef<HTMLElement>(null);
  const slots = useGame((s) => s.slots);
  const mage = useGame((s) => s.mage);
  const bonus = useMemo(() => {
    const syn = computeSynergy(slots).bonuses[index] ?? NO_BONUS;
    const p = playerPassiveMods(slots, mage, index);
    return {
      bonusValue: syn.bonusValue,
      cooldownMult: syn.cooldownMult * p.cdMult,
      valueMult: p.valueMult,
      active: p.active,
    };
  }, [slots, mage, index]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const hand = document.querySelector<HTMLElement>(".card-hand");
    let drag: {
      pointerId: number;
      offsetX: number;
      offsetY: number;
      startX: number;
      startY: number;
      moved: boolean;
      preview: HTMLElement;
    } | null = null;

    const overHand = (x: number, y: number) => {
      if (!hand) return false;
      const b = hand.getBoundingClientRect();
      return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
    };
    const clearDrop = () => hand?.classList.remove("is-drop-target");

    const onClick = () => {
      const s = useGame.getState();
      playEvent("ui:board.cardSelect");
      // O detalhe da carta virou a dica flutuante (hover/toque). O clique só
      // serve ao coringa armado; sem ele não há mais nada a fazer.
      if (s.armedJokerId) s.applyJoker(card.id);
    };

    const endDrag = (event: PointerEvent, shouldDrop: boolean) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dropped = shouldDrop && drag.moved && overHand(event.clientX, event.clientY);
      const wasMoved = drag.moved;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      document.body.classList.remove("dragging");
      clearDrop();
      drag.preview.remove();
      el.classList.remove("is-dragging-source");
      drag = null;
      if (dropped) useGame.getState().returnToHand(card.id);
      else if (shouldDrop && !wasMoved) onClick();
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
      if (event.button !== 0) return;
      if (useGame.getState().isCombat()) return;
      const bounds = el.getBoundingClientRect();
      const preview = el.cloneNode(true) as HTMLElement;
      preview.classList.remove("is-dragging-source");
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

    el.addEventListener("pointerdown", onDown);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      drag?.preview.remove();
    };
  }, [card]);

  const tipHandlers = useCardTip(card);

  return (
    <CardFace
      card={card}
      context="slot"
      innerRef={ref}
      synergyBonus={bonus}
      passiveActive={bonus.active}
      onPointerEnter={tipHandlers.onPointerEnter}
      onPointerLeave={tipHandlers.onPointerLeave}
    />
  );
}
