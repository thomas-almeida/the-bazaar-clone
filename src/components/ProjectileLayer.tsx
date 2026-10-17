"use client";

// Camada de projéteis (overlay fixo sobre o tabuleiro). Cada projétil carrega
// seu visual resolvido (`p.vfx`: cor, tamanho, espessura, blur, brilho...) e o
// motion:
//  - "shot": orbe reto e rápido + feixe de trajetória;
//  - "arc":  orbe em curva (bézier) com rastro de fantasmas que dissipa;
//  - "melee": sem trajetória — o corte surge direto na badge.
// Ao impactar, a badge treme e pisca vermelho (classe .is-hit). O mesmo
// ProjectileView é reaproveitado pelo preview do editor de VFX.

import { useEffect, useRef, type CSSProperties } from "react";
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

/** Pontos de uma bézier quadrática p0→c→p1, para montar os keyframes do arco. */
function bezierKeyframes(
  p0: { x: number; y: number },
  c: { x: number; y: number },
  p1: { x: number; y: number },
  steps = 14,
): Keyframe[] {
  const frames: Keyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x;
    const y = mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y;
    const scale = t < 0.15 ? 0.7 + (t / 0.15) * 0.3 : t > 0.9 ? 1 - (t - 0.9) * 1 : 1;
    frames.push({ transform: `translate(${x}px, ${y}px) scale(${scale})`, opacity: t > 0.96 ? 0.9 : 1 });
  }
  return frames;
}

/** Variáveis CSS a partir do visual resolvido da carta. */
function vfxVars(v: Projectile["vfx"]): CSSProperties {
  return {
    ["--vfx-color" as string]: v.color,
    ["--vfx-size" as string]: `${v.size}px`,
    ["--vfx-thickness" as string]: `${v.thickness}px`,
    ["--vfx-blur" as string]: `${v.blur}px`,
    ["--vfx-glow" as string]: `${v.glow}px`,
  };
}

export function ProjectileView({ p, onDone }: { p: Projectile; onDone: () => void }) {
  const orbRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hasTrail = p.motion === "arc" && p.vfx.trail > 0;
  const trailCount = hasTrail ? p.vfx.trail : 0;

  const dx = p.x1 - p.x0;
  const dy = p.y1 - p.y0;
  const distance = Math.hypot(dx, dy) || 1;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 1 : p.duration;

    let keyframes: Keyframe[];
    if (p.motion === "melee") {
      keyframes = [
        { transform: `translate(${p.x1}px, ${p.y1}px) scale(0.25) rotate(-58deg)`, opacity: 0 },
        { transform: `translate(${p.x1}px, ${p.y1}px) scale(1.15) rotate(-20deg)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${p.x1}px, ${p.y1}px) scale(1) rotate(-12deg)`, opacity: 0 },
      ];
    } else if (p.motion === "arc") {
      const nx = -dy / distance;
      const ny = dx / distance;
      const bow = distance * p.vfx.bow;
      const control = { x: p.x0 + dx * 0.5 + nx * bow, y: p.y0 + dy * 0.5 + ny * bow };
      keyframes = bezierKeyframes({ x: p.x0, y: p.y0 }, control, { x: p.x1, y: p.y1 });
    } else {
      keyframes = [
        { transform: `translate(${p.x0}px, ${p.y0}px) scale(0.8)`, opacity: 0.3 },
        { transform: `translate(${p.x0 + dx * 0.12}px, ${p.y0 + dy * 0.12}px) scale(1)`, opacity: 1, offset: 0.12 },
        { transform: `translate(${p.x1}px, ${p.y1}px) scale(0.95)`, opacity: 1 },
      ];
    }

    const easing = p.motion === "shot" ? "cubic-bezier(0.2, 0.6, 0.2, 1)" : "ease-out";
    const anim = orb.animate(keyframes, { duration, easing, fill: "forwards" });

    // Rastro: fantasmas que refazem a MESMA trajetória, atrasados e mais
    // apagados, formando uma cauda que segue o orbe e dissipa.
    const trailAnims: Animation[] = [];
    if (hasTrail && !reduce) {
      trailRefs.current.forEach((el, i) => {
        if (!el) return;
        const fade = 1 - (i + 1) / (trailCount + 1);
        const tk = keyframes.map((k) => ({
          transform: k.transform as string,
          opacity: (typeof k.opacity === "number" ? k.opacity : 1) * fade * 0.8,
        }));
        trailAnims.push(el.animate(tk, { duration, delay: (i + 1) * 28, easing, fill: "forwards" }));
      });
    }

    const onFinish = () => {
      flashBadge(p.targetSide);
      onDone();
    };
    anim.addEventListener("finish", onFinish);
    return () => {
      anim.removeEventListener("finish", onFinish);
      anim.cancel();
      trailAnims.forEach((a) => a.cancel());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vars = vfxVars(p.vfx);

  return (
    <>
      {p.motion === "shot" && (
        <span
          className="projectile-beam"
          style={{
            ...vars,
            left: p.x0,
            top: p.y0,
            width: distance,
            transform: `rotate(${angle}deg)`,
            animationDuration: `${p.duration}ms`,
          }}
        />
      )}
      {hasTrail &&
        Array.from({ length: trailCount }).map((_, i) => (
          <div
            key={i}
            ref={(el) => {
              trailRefs.current[i] = el;
            }}
            className="projectile-trail"
            style={{ ...vars, transform: `translate(${p.x0}px, ${p.y0}px)` }}
          />
        ))}
      <div
        ref={orbRef}
        className={`projectile-orb projectile-orb--${p.motion}${
          p.motion === "melee" ? "" : ` projectile-shape--${p.vfx.shape}`
        }`}
        style={{ ...vars, transform: `translate(${p.x0}px, ${p.y0}px)`, ["--angle" as string]: `${angle}deg` }}
      />
    </>
  );
}

export default function ProjectileLayer() {
  const projectiles = useProjectiles((s) => s.projectiles);
  const remove = useProjectiles((s) => s.remove);
  return (
    <div className="projectile-layer" aria-hidden="true">
      {projectiles.map((p) => (
        <ProjectileView key={p.id} p={p} onDone={() => remove(p.id)} />
      ))}
    </div>
  );
}
