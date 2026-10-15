"use client";

// Diálogo de resultado. Vitória de combate -> CONTINUAR (próxima fase);
// derrota -> REINICIAR RUN; fim das 3 voltas -> vitória da run (NOVA RUN).

import { useGame } from "@/lib/store";

export default function BattleResult() {
  const open = useGame((s) => s.battleResultOpen);
  const runComplete = useGame((s) => s.runComplete);
  const winner = useGame((s) => s.battleWinner);
  const opponentName = useGame((s) => s.battleOpponentName);
  const continueAfterWin = useGame((s) => s.continueAfterWin);
  const restartRun = useGame((s) => s.restartRun);

  if (runComplete) {
    return (
      <section className="battle-result" role="dialog" aria-modal="true" aria-labelledby="battle-result-title">
        <div className="battle-result-panel is-run-victory">
          <p className="battle-result-eyebrow">RUN CONCLUÍDA</p>
          <h2 id="battle-result-title">VOCÊ VENCEU A RUN!</h2>
          <p className="battle-result-message">Você sobreviveu às 3 voltas. Lendário.</p>
          <button className="battle-result-action" type="button" autoFocus onClick={restartRun}>
            NOVA RUN
          </button>
        </div>
      </section>
    );
  }

  if (!open) return null;
  const isWin = winner === "player";

  return (
    <section className="battle-result" role="dialog" aria-modal="true" aria-labelledby="battle-result-title">
      <div className="battle-result-panel">
        <p className="battle-result-eyebrow">BATALHA ENCERRADA</p>
        <h2 id="battle-result-title">{isWin ? "VOCÊ VENCEU!" : "VOCÊ PERDEU"}</h2>
        <p className="battle-result-message">
          {isWin
            ? `${opponentName ?? "O adversário"} foi derrotado.`
            : "Sua vida chegou a zero. Reinicie a run para tentar novamente."}
        </p>
        <button className="battle-result-action" type="button" autoFocus onClick={continueAfterWin}>
          {isWin ? "CONTINUAR" : "REINICIAR RUN"}
        </button>
      </div>
    </section>
  );
}
