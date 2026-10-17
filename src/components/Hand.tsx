"use client";

// Mão em leque (canto inferior direito). Tilt 3D no hover; arrastar para um slot
// vazio invoca, arrastar sobre uma carta igual abre o popup de fusão. Clique
// aplica o coringa armado (se houver) ou abre os detalhes. Sem limite de cartas.

import { useEffect, useRef } from "react";
import { useGame } from "@/lib/store";
import type { CardInstance } from "@/lib/types";
import { playEvent } from "@/lib/sfx";
import CardFace from "./CardFace";
import { useCardTip } from "@/hooks/useCardTip";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface ItemProps {
  card: CardInstance;
  index: number;
  total: number;
  handRef: React.RefObject<HTMLElement | null>;
}

function handStyle(index: number, total: number): React.CSSProperties {
  const spread = Math.min(15, 68 / Math.max(1, total - 1));
  const start = (100 - spread * (total - 1)) / 2;
  const offset = index - (total - 1) / 2;
  return {
    ["--card-index" as string]: index,
    ["--card-position" as string]: `${start + spread * index}%`,
    ["--card-angle" as string]: `${offset * 10}deg`,
    ["--card-lift" as string]: `${Math.abs(offset) * 24}px`,
  };
}

type Drop = { type: "merge"; id: string } | { type: "summon"; index: number } | null;

function HandCardItem({ card, index, total, handRef }: ItemProps) {
  const ref = useRef<HTMLElement>(null);
  const canAct = useGame((s) => !s.isCombat());

  // Tilt 3D no hover
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const hand = handRef.current;
    let bounds: DOMRect | null = null;
    let frame = 0;
    let previousTime = 0;
    let curX = 0, curY = 0, curDepth = 12, tgtX = 0, tgtY = 0, tgtDepth = 12;

    const animate = (time: number) => {
      const delta = previousTime ? Math.min(time - previousTime, 32) : 16;
      previousTime = time;
      const smoothing = 1 - Math.exp(-delta / 55);
      curX += (tgtX - curX) * smoothing;
      curY += (tgtY - curY) * smoothing;
      curDepth += (tgtDepth - curDepth) * smoothing;
      el.style.setProperty("--tilt-x", `${curX}deg`);
      el.style.setProperty("--tilt-y", `${curY}deg`);
      el.style.setProperty("--tilt-z", `${curDepth}px`);
      if (Math.abs(tgtX - curX) > 0.05 || Math.abs(tgtY - curY) > 0.05 || Math.abs(tgtDepth - curDepth) > 0.1) {
        frame = requestAnimationFrame(animate);
      } else frame = 0;
    };
    const onEnter = () => {
      if (el.parentElement !== hand) return;
      bounds = el.getBoundingClientRect();
      curX = tgtX = 0; curY = tgtY = 0; curDepth = tgtDepth = 12;
      el.classList.add("is-tilting");
    };
    const onMove = (event: PointerEvent) => {
      if (!bounds || el.parentElement !== hand) return;
      const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
      const hOff = (x - 0.5) * 2;
      const vOff = (y - 0.5) * 2;
      tgtX = -vOff * 20; tgtY = hOff * 20; tgtDepth = 12 + Math.max(Math.abs(hOff), Math.abs(vOff)) * 28;
      if (!frame) frame = requestAnimationFrame(animate);
    };
    const onLeave = () => {
      bounds = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0; previousTime = 0;
      el.classList.remove("is-tilting");
      el.style.removeProperty("--tilt-x");
      el.style.removeProperty("--tilt-y");
      el.style.removeProperty("--tilt-z");
    };
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [card.id, handRef]);

  // Drag: invocar (slot vazio) ou fundir (carta igual); clique = coringa/modal
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const hand = handRef.current;
    let drag: {
      pointerId: number; offsetX: number; offsetY: number;
      startX: number; startY: number; moved: boolean; preview: HTMLElement;
    } | null = null;

    const clearDropTargets = () =>
      document.querySelectorAll(".player-slot, .hand-card").forEach((n) => n.classList.remove("is-drop-target"));

    const resolveDrop = (x: number, y: number): Drop => {
      const els = document.elementsFromPoint(x, y);
      for (const e of els) {
        const cardEl = (e as HTMLElement).closest<HTMLElement>("[data-card-id]");
        if (cardEl && cardEl.dataset.cardId !== card.id && cardEl.dataset.cardName === card.def.name) {
          return { type: "merge", id: cardEl.dataset.cardId! };
        }
      }
      for (const e of els) {
        const slot = (e as HTMLElement).closest<HTMLElement>(".player-slot");
        if (slot && !slot.classList.contains("bot-empty-slot") && !slot.querySelector(".hand-card")) {
          return { type: "summon", index: Number(slot.dataset.slotIndex) };
        }
      }
      return null;
    };

    const endDrag = (event: PointerEvent, shouldDrop: boolean) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const drop = shouldDrop && drag.moved ? resolveDrop(event.clientX, event.clientY) : null;
      const wasMoved = drag.moved;
      document.body.classList.remove("dragging");
      clearDropTargets();
      drag.preview.remove();
      el.classList.remove("is-dragging-source", "is-tilting");
      el.style.removeProperty("--tilt-x");
      el.style.removeProperty("--tilt-y");
      el.style.removeProperty("--tilt-z");
      drag = null;

      const s = useGame.getState();
      if (drop?.type === "summon") s.summon(card.id, drop.index);
      else if (drop?.type === "merge") s.requestMerge(card.id, drop.id);
      else if (shouldDrop && !wasMoved) {
        playEvent("ui:board.cardSelect");
        // Os detalhes saem na dica flutuante; o clique sem coringa armado não
        // tem mais ação.
        if (s.armedJokerId) s.applyJoker(card.id);
      }
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || el.parentElement !== hand) return;
      if (useGame.getState().isCombat()) return;
      event.preventDefault();
      const bounds = el.getBoundingClientRect();
      const preview = el.cloneNode(true) as HTMLElement;
      preview.classList.remove("is-tilting", "is-dragging-source");
      preview.classList.add("drag-preview");
      preview.style.width = `${bounds.width}px`;
      preview.style.height = `${bounds.height}px`;
      preview.style.setProperty("--drag-x", `${bounds.left}px`);
      preview.style.setProperty("--drag-y", `${bounds.top}px`);
      preview.style.removeProperty("--tilt-x");
      preview.style.removeProperty("--tilt-y");
      preview.style.removeProperty("--tilt-z");
      document.body.append(preview);
      drag = {
        pointerId: event.pointerId,
        offsetX: event.clientX - bounds.left,
        offsetY: event.clientY - bounds.top,
        startX: event.clientX, startY: event.clientY, moved: false, preview,
      };
      el.setPointerCapture(event.pointerId);
    };

    const onMove = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (!drag.moved) {
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
        drag.moved = true;
        el.classList.add("is-dragging-source");
        document.body.classList.add("dragging");
      }
      drag.preview.style.setProperty("--drag-x", `${event.clientX - drag.offsetX}px`);
      drag.preview.style.setProperty("--drag-y", `${event.clientY - drag.offsetY}px`);
      clearDropTargets();
      const drop = resolveDrop(event.clientX, event.clientY);
      if (drop?.type === "summon") {
        const slot = document.querySelector<HTMLElement>(`.player-slot[data-slot-index="${drop.index}"]`);
        slot?.classList.add("is-drop-target");
      } else if (drop?.type === "merge") {
        document.querySelector<HTMLElement>(`[data-card-id="${drop.id}"]`)?.classList.add("is-drop-target");
      }
    };

    const onUp = (event: PointerEvent) => endDrag(event, true);
    const onCancel = (event: PointerEvent) => endDrag(event, false);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("lostpointercapture", onCancel);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("lostpointercapture", onCancel);
      drag?.preview.remove();
    };
  }, [card, handRef]);

  const tipHandlers = useCardTip(card);

  return (
    <CardFace
      card={card}
      context="hand"
      innerRef={ref}
      style={handStyle(index, total)}
      extraClass={canAct ? "is-summonable" : "is-unaffordable"}
      onPointerEnter={tipHandlers.onPointerEnter}
      onPointerLeave={tipHandlers.onPointerLeave}
    />
  );
}

export default function Hand() {
  const hand = useGame((s) => s.hand);
  const handRef = useRef<HTMLElement>(null);
  return (
    <section className="card-hand" aria-label="Mão de cartas" ref={handRef}>
      {hand.map((card, i) => (
        <HandCardItem key={card.id} card={card} index={i} total={hand.length} handRef={handRef} />
      ))}
    </section>
  );
}
