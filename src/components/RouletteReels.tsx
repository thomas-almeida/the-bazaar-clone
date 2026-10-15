"use client";

// Slots da roleta (caça-níquel). Antes de rodar: 4 reels ociosos. Girando:
// animação de rolagem. Parado: 4 cartas de tier aleatório; o jogador escolhe 1.

import { useGame } from "@/lib/store";
import CardFace from "./CardFace";

export default function RouletteReels() {
  const roulette = useGame((s) => s.roulette);
  const pick = useGame((s) => s.pickRoulette);

  if (!roulette.spun) {
    return (
      <>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="roulette-reel is-idle">
            <span className="roulette-reel-mark">?</span>
          </div>
        ))}
      </>
    );
  }

  if (roulette.spinning) {
    return (
      <>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="roulette-reel is-spinning" style={{ animationDelay: `${i * 90}ms` }}>
            <div className="roulette-strip" />
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      {roulette.cards.map((card) => (
        <div
          key={card.id}
          className={`roulette-reel is-revealed ${roulette.picked ? "is-locked" : "is-pickable"}`}
          onClick={() => pick(card.id)}
          role="button"
          aria-label={`Escolher ${card.def.name}`}
        >
          <CardFace card={card} context="combat" />
        </div>
      ))}
    </>
  );
}
