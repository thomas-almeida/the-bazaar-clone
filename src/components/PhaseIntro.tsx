"use client";

// Banner de introdução de fase: surge brevemente ao entrar em cada fase,
// deixando claro para o jogador o que é aquela fase.

import { useEffect, useState } from "react";
import { useGame } from "@/lib/store";

const INTRO: Record<string, { title: string; sub: string; cls: string }> = {
  market: { title: "BAZAR", sub: "Monte sua build nas lojas", cls: "intro-market" },
  adventure: { title: "AVENTURA", sub: "Escolha uma situação", cls: "intro-adventure" },
  bot: { title: "COMBATE", sub: "Escolha o oponente", cls: "intro-bot" },
  player: { title: "DESAFIO", sub: "Enfrente outro mago", cls: "intro-player" },
};

export default function PhaseIntro() {
  const phase = useGame((s) => s.phase);
  const phaseIndex = useGame((s) => s.phaseIndex);
  const pass = useGame((s) => s.passNumber());
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 1900);
    return () => window.clearTimeout(t);
  }, [phaseIndex]);

  const info = INTRO[phase];
  if (!visible || !info) return null;

  return (
    <div className={`phase-intro ${info.cls}`} aria-hidden="true">
      <span className="phase-intro-pass">VOLTA {pass} / 3</span>
      <span className="phase-intro-title display-title">{info.title}</span>
      <span className="phase-intro-sub">{info.sub}</span>
    </div>
  );
}
