"use client";

// Camada do tutorial guiado. Lê o roteiro de `lib/tutorial`, acompanha o estado
// do jogo (store) e, a cada passo, escurece a tela com um "buraco" iluminado e
// clicável sobre os elementos relevantes (spotlight bloqueante), mais uma bolha
// de dica. Avança sozinho quando o jogador realiza a ação, ou no clique dos
// passos de explicação. Ativa-se só com `?tutorial=1` na URL de /play.

import { useCallback, useEffect, useRef, useState } from "react";
import { useGame } from "@/lib/store";
import { useAuth } from "@/components/AuthProvider";
import { playEvent } from "@/lib/sfx";
import { TUTORIAL_STEPS, type TutorialProgress } from "@/lib/tutorial";

const HOLE_PAD = 10;
const BUBBLE_W = 360;

function unionRect(selectors: string[]): DOMRect | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  let found = false;
  for (const sel of selectors) {
    let el: Element | null = null;
    try {
      el = document.querySelector(sel);
    } catch {
      el = null;
    }
    if (!el) continue;
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) continue;
    found = true;
    left = Math.min(left, b.left);
    top = Math.min(top, b.top);
    right = Math.max(right, b.right);
    bottom = Math.max(bottom, b.bottom);
  }
  if (!found) return null;
  return new DOMRect(
    left - HOLE_PAD,
    top - HOLE_PAD,
    right - left + HOLE_PAD * 2,
    bottom - top + HOLE_PAD * 2,
  );
}

export default function TutorialOverlay() {
  const { markTutorialDone } = useAuth();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [panelH, setPanelH] = useState(260);
  const advancingRef = useRef(false);

  // Estado do jogo que as condições de avanço observam.
  const phase = useGame((s) => s.phase);
  const hasRolled = useGame((s) => s.hasRolledThisMarket);
  const shopOpen = useGame((s) => s.shopView !== null);
  const handCount = useGame((s) => s.hand.length);
  const slotsFilled = useGame((s) => s.slots.filter(Boolean).length);
  const adventurePicked = useGame((s) => s.adventure.picked);
  const battleActive = useGame((s) => s.battleActive);

  // Ativa só em /play?tutorial=1.
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("tutorial") === "1") {
        setActive(true);
      }
    } catch {
      /* sem window: nada a fazer */
    }
  }, []);

  const step = active ? TUTORIAL_STEPS[stepIndex] : null;
  const hasAnchors = !!step?.anchors && step.anchors.length > 0;

  // Enquanto o passo tem âncoras, re-mede o retângulo a cada frame (o tabuleiro
  // anima e troca de conteúdo entre as fases).
  useEffect(() => {
    if (!step || !hasAnchors) {
      setRect(null);
      return;
    }
    let raf = 0;
    let prev: DOMRect | null = null;
    const same = (a: DOMRect | null, b: DOMRect | null) =>
      (!a && !b) ||
      (!!a && !!b &&
        Math.abs(a.left - b.left) < 0.5 &&
        Math.abs(a.top - b.top) < 0.5 &&
        Math.abs(a.width - b.width) < 0.5 &&
        Math.abs(a.height - b.height) < 0.5);
    const tick = () => {
      const next = unionRect(step.anchors!);
      // Só re-renderiza quando o alvo realmente se moveu/redimensionou — evita
      // 60 re-renders por segundo com o tabuleiro parado.
      if (!same(prev, next)) {
        prev = next;
        setRect(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, hasAnchors]);

  const finish = useCallback(() => {
    setActive(false);
    void markTutorialDone();
    // Tira o parâmetro da URL para um F5 não reiniciar o tutorial no meio da run.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("tutorial");
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* ignora */
    }
  }, [markTutorialDone]);

  const goNext = useCallback(() => {
    advancingRef.current = false;
    setStepIndex((i) => {
      if (i + 1 >= TUTORIAL_STEPS.length) {
        finish();
        return i;
      }
      playEvent("event:optionSelected");
      return i + 1;
    });
  }, [finish]);

  // Avanço automático: quando a condição do passo atual é satisfeita.
  useEffect(() => {
    if (!step || !step.done || advancingRef.current) return;
    const progress: TutorialProgress = {
      phase,
      hasRolled,
      shopOpen,
      handCount,
      slotsFilled,
      adventurePicked,
      battleActive,
    };
    if (step.done(progress)) {
      advancingRef.current = true;
      const t = window.setTimeout(goNext, 500);
      return () => window.clearTimeout(t);
    }
  }, [
    step,
    phase,
    hasRolled,
    shopOpen,
    handCount,
    slotsFilled,
    adventurePicked,
    battleActive,
    goNext,
  ]);

  if (!active || !step) return null;

  // Posição do balão. Sem escurecer a tela, o essencial é o painel ficar SEMPRE
  // inteiro na janela: tenta abaixo do destaque, senão acima, senão ao lado; em
  // todos os casos preso dentro da janela (clamp) usando a altura medida.
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 720;
  const M = 16; // margem mínima da borda
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  let bubbleStyle: React.CSSProperties;
  if (hasAnchors && rect) {
    const cx = rect.left + rect.width / 2;
    let left = clamp(cx - BUBBLE_W / 2, M, vw - BUBBLE_W - M);
    let top: number;
    if (rect.bottom + 12 + panelH + M <= vh) {
      top = rect.bottom + 12; // cabe abaixo
    } else if (rect.top - 12 - panelH >= M) {
      top = rect.top - 12 - panelH; // cabe acima
    } else if (rect.right + 12 + BUBBLE_W + M <= vw) {
      left = rect.right + 12; // ao lado direito
      top = clamp(rect.top, M, vh - panelH - M);
    } else if (rect.left - 12 - BUBBLE_W >= M) {
      left = rect.left - 12 - BUBBLE_W; // ao lado esquerdo
      top = clamp(rect.top, M, vh - panelH - M);
    } else {
      top = clamp(rect.top, M, vh - panelH - M); // sobrepõe, mas inteiro na tela
    }
    bubbleStyle = { left, top };
  } else {
    bubbleStyle = {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: BUBBLE_W,
    };
  }

  const stepNumber = stepIndex + 1;
  const total = TUTORIAL_STEPS.length;

  return (
    <div className="tutorial-layer" role="dialog" aria-modal="true" aria-label="Tutorial">
      {/* Sem escurecer a tela: só um anel de destaque em volta do alvo, para o
          jogador ver onde agir sem perder a visão do tabuleiro. */}
      {hasAnchors && rect && (
        <div
          className="tutorial-spotlight"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
          aria-hidden="true"
        />
      )}

      {/* Mesma UI do menu: painel + eyebrow + h2 + copy + botões .home-item.
          As classes `tutorial-*` aqui só fazem POSICIONAMENTO (flutuar junto do
          spotlight), nunca aparência. */}
      <div
        ref={(el) => {
          if (el && Math.abs(el.offsetHeight - panelH) > 2) setPanelH(el.offsetHeight);
        }}
        className="fullscreen-prompt-panel tutorial-panel"
        style={bubbleStyle}
      >
        <p className="fullscreen-prompt-eyebrow">PASSO {stepNumber} / {total} · MAGGI</p>
        <h2>{step.title}</h2>
        <p className="fullscreen-prompt-copy">{step.body}</p>

        <div className="fullscreen-prompt-actions">
          {step.done === null ? (
            <button type="button" className="home-item home-item--play fullscreen-prompt-action" onClick={goNext}>
              <span className="home-item-label">{step.cta ?? "CONTINUAR"}</span>
            </button>
          ) : (
            <span className="tutorial-hint" aria-live="polite">
              <span className="tutorial-hint-dot" aria-hidden="true" />
              Faça a ação destacada para continuar
            </span>
          )}
          <button type="button" className="home-item fullscreen-prompt-action" onClick={finish}>
            <span className="home-item-label">PULAR TUTORIAL</span>
          </button>
        </div>
      </div>
    </div>
  );
}
