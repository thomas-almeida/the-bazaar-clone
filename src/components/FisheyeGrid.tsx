"use client";

// Grade de cartas com perspectiva olho-de-peixe (fisheye): cada carta se
// distorce em função da distância ao centro da tela (centro maiores, bordas
// menores e inclinadas). No hover a carta dá um "pop" (cresce). A distorção é
// recalculada em resize/scroll; o pop é via CSS (:hover), então acontece
// sucessivamente conforme o mouse passa pelas cartas.

import { useCallback, useEffect, useRef } from "react";
import type { CardInstance } from "@/lib/types";
import CardFace from "./CardFace";

export default function FisheyeGrid({
  cards,
  onPick,
}: {
  cards: CardInstance[];
  onPick: (card: CardInstance) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement[]>([]);
  itemsRef.current = [];

  const register = (el: HTMLDivElement | null) => {
    if (el && !itemsRef.current.includes(el)) itemsRef.current.push(el);
  };

  const apply = useCallback(() => {
    const cont = containerRef.current;
    if (!cont) return;
    const cr = cont.getBoundingClientRect();
    // Centro da lente = centro do grid; distorção radial a partir daí.
    const cx = cr.left + cr.width / 2;
    const cy = cr.top + cr.height / 2;
    const maxD = Math.hypot(cr.width / 2, cr.height / 2) || 1;
    for (const el of itemsRef.current) {
      const r = el.getBoundingClientRect();
      const dx = (r.left + r.width / 2 - cx) / maxD;
      const dy = (r.top + r.height / 2 - cy) / maxD;
      const d = Math.min(1, Math.hypot(dx, dy));
      // easing (d^1.4) para centro mais "reto" e bordas caindo mais rápido
      const e = Math.pow(d, 1.4);
      el.style.setProperty("--fe-scale", String(1 - e * 0.5));
      el.style.setProperty("--fe-tx", `${-dx * e * 42}px`);
      el.style.setProperty("--fe-ty", `${-dy * e * 42}px`);
      el.style.setProperty("--fe-rx", `${dy * 20}deg`);
      el.style.setProperty("--fe-ry", `${-dx * 20}deg`);
      el.style.setProperty("--fe-op", String(1 - e * 0.25));
    }
  }, []);

  // Reaplica ao montar, trocar de deck (cards), redimensionar e rolar.
  useEffect(() => {
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    schedule();
    const t = window.setTimeout(schedule, 120); // após o primeiro paint/layout
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [apply, cards]);

  return (
    <div className="fisheye" ref={containerRef}>
      {cards.map((card) => (
        <div key={card.id} ref={register} className="fisheye-item" onClick={() => onPick(card)}>
          <CardFace card={card} context="hand" />
        </div>
      ))}
    </div>
  );
}
