"use client";

// Tela de resultado (vitória/derrota) no estilo da tela VS: fundo preto com
// blur, badge do mago e a palavra VITÓRIA/DERROTA. Abre e fecha sozinha (fade).
// Ao fechar:
//  - resultado TERMINAL da run (venceu a run, ou perdeu para um JOGADOR) → vai
//    para o placar de líderes automaticamente;
//  - resultado não-terminal (venceu uma luta, ou perdeu para um NPC) → segue a
//    run (próxima fase).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/lib/store";
import { applyOverride, useMageConfig } from "@/lib/mage-config";
import { recordRunResult, toSnapshotSlots } from "@/lib/leaderboard";
import { playEvent } from "@/lib/sfx";
import { useAuth } from "./AuthProvider";

const HOLD_MS = 3000;
const FADE_MS = 420;

export default function BattleResult() {
  const open = useGame((s) => s.battleResultOpen);
  const runComplete = useGame((s) => s.runComplete);
  const winner = useGame((s) => s.battleWinner);
  const phase = useGame((s) => s.phase);
  const baseMage = useGame((s) => s.mage);
  const config = useMageConfig((s) => s.config);
  const mage = baseMage ? applyOverride(baseMage, config) : null;
  const continueAfterWin = useGame((s) => s.continueAfterWin);
  const restartRun = useGame((s) => s.restartRun);
  const { user } = useAuth();
  const router = useRouter();

  const active = runComplete || open;
  const isWin = runComplete || winner === "player";
  // Perder para um jogador (rival, fase "player") encerra a run; perder para um
  // NPC não. Vencer a run (runComplete) também é terminal.
  const isRunLoss = winner === "opponent" && phase === "player";
  const terminal = runComplete || isRunLoss;

  const [leaving, setLeaving] = useState(false);
  const firedRef = useRef(false);
  const recordedRef = useRef(false);

  // Gravação no placar: só em estado terminal, uma vez por run.
  useEffect(() => {
    if (!terminal) { recordedRef.current = false; return; }
    if (recordedRef.current) return;
    recordedRef.current = true;
    if (!user) return;
    const s = useGame.getState();
    const name = (user.user_metadata?.display_name as string | undefined)?.trim() || "JOGADOR";
    void recordRunResult(user, {
      name,
      mageId: s.mage?.id ?? "",
      victories: s.victories,
      completed: runComplete,
      slots: toSnapshotSlots(s.slots),
    });
  }, [terminal, runComplete, user]);

  // Transição automática: som ao abrir, segura, fade e então age.
  useEffect(() => {
    if (!active) { setLeaving(false); firedRef.current = false; return; }
    playEvent(isWin ? "event:runWin" : "event:runDefeated");
    const hold = window.setTimeout(() => setLeaving(true), HOLD_MS);
    const go = window.setTimeout(() => {
      if (firedRef.current) return;
      firedRef.current = true;
      if (terminal) {
        restartRun(); // deixa a próxima visita a /play limpa
        router.push("/leaderboard");
      } else {
        continueAfterWin();
      }
    }, HOLD_MS + FADE_MS);
    return () => { window.clearTimeout(hold); window.clearTimeout(go); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, terminal, isWin]);

  if (!active) return null;

  const title = runComplete
    ? "VITÓRIA DA RUN"
    : isWin
      ? "VITÓRIA"
      : isRunLoss
        ? "DERROTA"
        : "VOCÊ CAIU";
  const sub = runComplete
    ? "Você sobreviveu às 3 voltas."
    : isWin
      ? "Adversário derrotado."
      : isRunLoss
        ? "Um rival te superou. A run acabou."
        : "Perdeu para o NPC, mas a run continua.";

  return (
    <div
      className={`versus-screen battle-outcome ${isWin ? "is-win" : "is-loss"} ${leaving ? "is-leaving" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="versus-side battle-outcome-side" style={mage ? { ["--accent" as string]: mage.accent } : undefined}>
        <span className={`versus-badge ${mage?.cutout ? "has-cutout" : ""}`}>
          {mage?.cutout ? (
            <>
              <span className="versus-badge-frame">
                <img className="versus-badge-photo" src={mage.portrait} alt="" />
              </span>
              <img className="versus-badge-cutout" src={mage.cutout} alt="" aria-hidden="true" />
            </>
          ) : (
            <img className="versus-badge-img" src={mage?.portrait ?? "/boargame/img/cover-3.jpg"} alt="" />
          )}
        </span>
        <span className="battle-outcome-title">{title}</span>
        <span className="battle-outcome-sub">{sub}</span>
      </div>
    </div>
  );
}
