"use client";

// Console do dado (canto inferior esquerdo) + medidor de mana.
// Porta a rolagem 3D, o arraste dentro do palco e a regra de rolar uma vez por
// loja de board.js. Com mana infinita o resultado não altera o recurso, mas a
// rolagem continua obrigatória para liberar o AVANÇAR.

import { useEffect, useRef, useState } from "react";
import { useGame } from "@/lib/store";

const FACE_ROTATIONS: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [90, 0, 0],
  3: [0, 0, -90],
  4: [0, 0, 90],
  5: [-90, 0, 0],
  6: [180, 0, 0],
};

const PIP_FACES: { value: number; cls: string; pips: number }[] = [
  { value: 1, cls: "die-face-top", pips: 1 },
  { value: 2, cls: "die-face-front", pips: 2 },
  { value: 3, cls: "die-face-right", pips: 3 },
  { value: 4, cls: "die-face-left", pips: 4 },
  { value: 5, cls: "die-face-back", pips: 5 },
  { value: 6, cls: "die-face-bottom", pips: 6 },
];

export default function DiceConsole() {
  const infiniteMana = useGame((s) => s.config.infiniteMana);
  const maxMana = useGame((s) => s.config.maxMana);
  const mana = useGame((s) => s.mana);
  const phase = useGame((s) => s.phase);
  const hasRolled = useGame((s) => s.hasRolledThisMarket);

  const dieRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [resultFace, setResultFace] = useState<number | null>(null);
  const [srText, setSrText] = useState("Role para ganhar mana");

  const disabled = phase !== "market" || hasRolled;

  useEffect(() => {
    const die = dieRef.current;
    const stage = stageRef.current;
    if (!die || !stage) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let currentFace = 1;
    let drag: {
      pointerId: number;
      startX: number;
      startY: number;
      offsetX: number;
      offsetY: number;
      moved: boolean;
    } | null = null;
    let suppressNextClick = false;

    die.style.setProperty("--die-x", "0deg");
    die.style.setProperty("--die-y", "0deg");
    die.style.setProperty("--die-z", "0deg");

    const readOffset = (prop: string) => Number.parseFloat(die.style.getPropertyValue(prop)) || 0;
    const setOffset = (axis: "x" | "y", value: number) => {
      die.style.setProperty(`--die-offset-${axis}`, `${value}px`);
      stage.style.setProperty(`--die-offset-${axis}`, `${value}px`);
    };

    const finishRoll = (face: number) => {
      const [x, y, z] = FACE_ROTATIONS[face];
      die.style.setProperty("--die-x", `${x}deg`);
      die.style.setProperty("--die-y", `${y}deg`);
      die.style.setProperty("--die-z", `${z}deg`);
      die.classList.remove("is-rolling");
      currentFace = face;
      setResultFace(face);
      useGame.getState().rollDie(face);
      setSrText(
        useGame.getState().config.infiniteMana
          ? `Resultado: ${face}. Mana infinita`
          : `Resultado: ${face}. Mana: ${useGame.getState().mana}`,
      );
    };

    const roll = () => {
      const s = useGame.getState();
      if (s.phase !== "market" || s.hasRolledThisMarket) return;
      const nextFace = Math.floor(Math.random() * 6) + 1;
      setResultFace(null);
      setSrText("Rolando...");
      if (reduceMotion) {
        finishRoll(nextFace);
        return;
      }
      const [endX, endY, endZ] = FACE_ROTATIONS[nextFace];
      die.style.setProperty("--roll-start-x", die.style.getPropertyValue("--die-x") || "0deg");
      die.style.setProperty("--roll-start-y", die.style.getPropertyValue("--die-y") || "0deg");
      die.style.setProperty("--roll-start-z", die.style.getPropertyValue("--die-z") || "0deg");
      die.style.setProperty("--roll-end-x", `${endX}deg`);
      die.style.setProperty("--roll-end-y", `${endY}deg`);
      die.style.setProperty("--roll-end-z", `${endZ}deg`);
      die.dataset.pendingFace = String(nextFace);
      die.classList.remove("is-rolling");
      void die.offsetWidth;
      die.classList.add("is-rolling");
    };

    const onDown = (event: PointerEvent) => {
      const s = useGame.getState();
      if (
        s.phase !== "market" ||
        s.hasRolledThisMarket ||
        (event.pointerType === "mouse" && event.button !== 0)
      )
        return;
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: readOffset("--die-offset-x"),
        offsetY: readOffset("--die-offset-y"),
        moved: false,
      };
      die.setPointerCapture(event.pointerId);
    };

    const onMove = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      const sb = stage.getBoundingClientRect();
      const halfDie = die.offsetWidth / 2 + 4;
      const maxX = Math.max(0, sb.width / 2 - halfDie);
      const maxY = Math.max(0, sb.height / 2 - halfDie);
      setOffset("x", Math.max(-maxX, Math.min(maxX, drag.offsetX + dx)));
      setOffset("y", Math.max(-maxY, Math.min(maxY, drag.offsetY + dy)));
      die.classList.add("is-dragging");
    };

    const finishDrag = (event: PointerEvent, shouldRoll: boolean) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dragged = drag.moved;
      drag = null;
      die.classList.remove("is-dragging");
      if (!dragged) return;
      suppressNextClick = true;
      window.setTimeout(() => (suppressNextClick = false), 0);
      if (shouldRoll) roll();
    };

    const onUp = (event: PointerEvent) => finishDrag(event, true);
    const onCancel = (event: PointerEvent) => finishDrag(event, false);
    const onClick = () => {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      roll();
    };
    const onAnimEnd = (event: AnimationEvent) => {
      if (event.animationName !== "dice-roll") return;
      finishRoll(Number(die.dataset.pendingFace) || currentFace);
      delete die.dataset.pendingFace;
    };

    die.addEventListener("pointerdown", onDown);
    die.addEventListener("pointermove", onMove);
    die.addEventListener("pointerup", onUp);
    die.addEventListener("pointercancel", onCancel);
    die.addEventListener("lostpointercapture", onCancel);
    die.addEventListener("click", onClick);
    die.addEventListener("animationend", onAnimEnd);
    return () => {
      die.removeEventListener("pointerdown", onDown);
      die.removeEventListener("pointermove", onMove);
      die.removeEventListener("pointerup", onUp);
      die.removeEventListener("pointercancel", onCancel);
      die.removeEventListener("lostpointercapture", onCancel);
      die.removeEventListener("click", onClick);
      die.removeEventListener("animationend", onAnimEnd);
    };
  }, []);

  const filled = (i: number) => infiniteMana || i < mana;

  return (
    <section className="dice-console" aria-label="Mini tabuleiro do dado">
      <div
        className="mana-meter"
        role="meter"
        aria-label={infiniteMana ? "Mana infinita" : `Mana atual: ${mana} de ${maxMana}`}
        aria-valuemin={0}
        aria-valuemax={maxMana}
        aria-valuenow={infiniteMana ? maxMana : mana}
      >
        <div className="mana-pips" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className={filled(i) ? "is-filled" : ""} />
          ))}
        </div>
        <span className="mana-label">MANA</span>
        <span className="mana-value">{infiniteMana ? "∞" : `${mana}/${maxMana}`}</span>
      </div>
      <div className="dice-stage" ref={stageRef}>
        <button
          className="dice-cube"
          ref={dieRef}
          type="button"
          disabled={disabled}
          aria-label="Rolar dado de seis faces"
        >
          {PIP_FACES.map((face) => (
            <span
              key={face.value}
              className={`die-face ${face.cls} ${resultFace === face.value ? "is-result-face" : ""}`}
              data-value={face.value}
              aria-hidden="true"
            >
              <span className={`die-pips die-pips-${face.pips}`}>
                {Array.from({ length: face.pips }).map((_, i) => (
                  <i key={i} className="die-pip" />
                ))}
              </span>
            </span>
          ))}
        </button>
      </div>
      <output className="sr-only" aria-live="polite">
        {srText}
      </output>
    </section>
  );
}
