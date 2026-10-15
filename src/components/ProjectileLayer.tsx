"use client";

// Camada de projéteis (overlay fixo sobre o tabuleiro). Cada projétil mostra a
// trajetória (feixe) e um orbe que viaja da carta até a badge; ao chegar, faz a
// badge tremer e piscar vermelho (classe .is-hit).

import { useEffect, useRef } from "react";
import { useProjectiles, type Projectile } from "@/lib/projectiles";

function flashBadge(targetSide: Projectile["targetSide"]) {
  const badge = document.querySelector<HTMLElement>(
    targetSide === "opponent"
      ? ".board-owner-badge:not(.board-player-badge)"
      : ".board-player-badge",
  );
  if (!badge) return;
  badge.classList.remove("is-hit");
  void badge.offsetWidth; // reflow para reiniciar a animação
  badge.classList.add("is-hit");
  window.setTimeout(() => badge.classList.remove("is-hit"), 520);
}

function ProjectileView({ p }: { p: Projectile }) {
  const orbRef = useRef<HTMLDivElement>(null);
  const remove = useProjectiles((s) => s.remove);

  const dx = p.x1 - p.x0;
  const dy = p.y1 - p.y0;
  const distance = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 1 : p.duration;

    const anim = orb.animate(
      [
        { transform: `translate(${p.x0}px, ${p.y0}px) scale(0.7)`, opacity: 0.2 },
        { transform: `translate(${p.x0 + dx * 0.15}px, ${p.y0 + dy * 0.15}px) scale(1)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${p.x1}px, ${p.y1}px) scale(0.9)`, opacity: 1 },
      ],
      { duration, easing: "cubic-bezier(0.45, 0.05, 0.55, 0.95)", fill: "forwards" },
    );
    const onFinish = () => {
      flashBadge(p.targetSide);
      remove(p.id);
    };
    anim.addEventListener("finish", onFinish);
    return () => {
      anim.removeEventListener("finish", onFinish);
      anim.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <span
        className="projectile-beam"
        style={{
          left: p.x0,
          top: p.y0,
          width: distance,
          transform: `rotate(${angle}deg)`,
          animationDuration: `${p.duration}ms`,
        }}
      />
      <div
        ref={orbRef}
        className="projectile-orb"
        style={{
          transform: `translate(${p.x0}px, ${p.y0}px)`,
          ["--angle" as string]: `${angle}deg`,
        }}
      />
    </>
  );
}

export default function ProjectileLayer() {
  const projectiles = useProjectiles((s) => s.projectiles);
  return (
    <div className="projectile-layer" aria-hidden="true">
      {projectiles.map((p) => (
        <ProjectileView key={p.id} p={p} />
      ))}
    </div>
  );
}
