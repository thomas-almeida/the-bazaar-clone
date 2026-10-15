"use client";

// Popup de confirmação de fusão. Surge ao arrastar uma carta sobre outra igual.
// Confirmar funde: a carta-alvo sobe +1 tier e a duplicata é consumida.

import { useGame } from "@/lib/store";
import { MAX_TIER, tierKey } from "@/lib/tiers";

export default function MergePrompt() {
  const prompt = useGame((s) => s.mergePrompt);
  const hand = useGame((s) => s.hand);
  const slots = useGame((s) => s.slots);
  const confirm = useGame((s) => s.confirmMerge);
  const cancel = useGame((s) => s.cancelMerge);

  if (!prompt) return null;
  const find = (id: string) =>
    hand.find((c) => c.id === id) ?? slots.find((c) => c?.id === id) ?? null;
  const target = find(prompt.targetId);
  if (!target) return null;
  const nextTier = Math.min(MAX_TIER, target.tier + 1);

  return (
    <div
      className="merge-modal"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
    >
      <div className="merge-panel">
        <p className="merge-eyebrow">FUNDIR CARTAS</p>
        <h2>{target.def.name}</h2>
        <p className="merge-message">
          Fundir a duplicata e subir <strong>{tierKey(target.tier)} → {tierKey(nextTier)}</strong>?
        </p>
        <div className="merge-actions">
          <button type="button" className="merge-confirm" onClick={confirm}>
            FUNDIR
          </button>
          <button type="button" className="merge-cancel" onClick={cancel}>
            CANCELAR
          </button>
        </div>
      </div>
    </div>
  );
}
