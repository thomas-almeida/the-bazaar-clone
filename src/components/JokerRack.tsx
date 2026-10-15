"use client";

// Rack de coringas à direita do tabuleiro (3 slots, do tamanho das badges).
// Clique arma/desarma um coringa; depois clique numa carta para aplicá-lo
// (fora de batalha). O coringa eleva a carta até o seu tier-alvo.

import { useGame } from "@/lib/store";
import { tierAccent, tierKey } from "@/lib/tiers";

export default function JokerRack() {
  const jokers = useGame((s) => s.jokers);
  const armed = useGame((s) => s.armedJokerId);
  const arm = useGame((s) => s.armJoker);
  const inCombat = useGame((s) => s.isCombat());

  return (
    <aside className="joker-rack" aria-label="Coringas de nível">
      {Array.from({ length: 3 }).map((_, i) => {
        const joker = jokers[i];
        if (!joker) {
          return <div key={i} className="joker-slot is-empty" aria-hidden="true" />;
        }
        const isArmed = armed === joker.id;
        return (
          <button
            key={joker.id}
            type="button"
            className={`joker-slot is-filled tier-${tierKey(joker.tier)} ${isArmed ? "is-armed" : ""}`}
            style={{ ["--card-accent" as string]: tierAccent(joker.tier) }}
            disabled={inCombat}
            onClick={() => arm(joker.id)}
            aria-label={`Coringa tier ${tierKey(joker.tier)}${isArmed ? " (selecionado)" : ""}`}
            title={inCombat ? "Use fora de batalha" : "Selecione e clique numa carta para aplicar"}
          >
            <span className="joker-star" aria-hidden="true">★</span>
            <span className="joker-tier">{tierKey(joker.tier)}</span>
          </button>
        );
      })}
    </aside>
  );
}
