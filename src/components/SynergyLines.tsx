"use client";

// Linhas que ligam cartas em sinergia no tabuleiro do jogador, para o jogador
// enxergar quais cartas estão interagindo (fonte -> vizinho buffado). Overlay
// fixo; mede os elementos das cartas e desenha um feixe entre os centros.

import { useLayoutEffect, useMemo, useState } from "react";
import { useGame } from "@/lib/store";
import { computeSynergy } from "@/lib/synergy";

interface Line {
  x: number;
  y: number;
  length: number;
  angle: number;
}

export default function SynergyLines() {
  const slots = useGame((s) => s.slots);
  const links = useMemo(() => computeSynergy(slots).links, [slots]);
  const [lines, setLines] = useState<Line[]>([]);

  useLayoutEffect(() => {
    const centerOf = (slotIndex: number) => {
      const el = document.querySelector<HTMLElement>(
        `.player-slot[data-slot-index="${slotIndex}"] .hand-card`,
      );
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const next: Line[] = [];
    for (const { from, to } of links) {
      const a = centerOf(from);
      const b = centerOf(to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      next.push({
        x: a.x,
        y: a.y,
        length: Math.hypot(dx, dy),
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      });
    }
    setLines(next);
  }, [links, slots]);

  if (lines.length === 0) return null;

  return (
    <div className="synergy-layer" aria-hidden="true">
      {lines.map((l, i) => (
        <span
          key={i}
          className="synergy-line"
          style={{ left: l.x, top: l.y, width: l.length, transform: `rotate(${l.angle}deg)` }}
        />
      ))}
    </div>
  );
}
