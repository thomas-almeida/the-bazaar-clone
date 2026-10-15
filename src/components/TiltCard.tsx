"use client";

// Wrapper leve de inclinação 3D (estilo react-tilt) para a grade de cartas.
// Inclina conforme a posição do ponteiro e volta ao soltar.

import { useRef } from "react";

export default function TiltCard({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${-y * 16}deg`);
    el.style.setProperty("--ry", `${x * 16}deg`);
    el.style.setProperty("--lift", "-6px");
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--lift", "0px");
  };

  return (
    <div
      ref={ref}
      className="tilt-card"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
