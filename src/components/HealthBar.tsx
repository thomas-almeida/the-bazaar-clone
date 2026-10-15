"use client";

// Barra de vida (verde) com faixa de escudo (amarela). Porta de
// updateCombatHealthBar. Largura e número vêm do store; o popup transitório
// (.battle-health-effect) é controlado pelo motor de combate.

import { useGame } from "@/lib/store";
import type { Side } from "@/lib/types";

export default function HealthBar({ side }: { side: Side }) {
  const maxHealth = useGame((s) => s.config.maxHealth);
  const health = useGame((s) => (side === "player" ? s.playerHealth : s.opponentHealth));
  const shield = useGame((s) => (side === "player" ? s.playerShield : s.opponentShield));
  const visible = useGame((s) => (side === "player" ? true : s.opponentHealthVisible));

  const clamped = Math.max(0, Math.min(maxHealth, health));
  const healthPercent = `${(clamped / maxHealth) * 100}%`;
  const shieldPercent = `${Math.min(100, (shield / maxHealth) * 100)}%`;

  return (
    <div
      className={`battle-health ${side === "player" ? "player-health" : "opponent-health"}`}
      data-health={side}
      role="meter"
      aria-label={`Vida ${side === "player" ? "do jogador" : "do adversário"}: ${clamped} de ${maxHealth}${shield > 0 ? `; escudo ${shield}` : ""}`}
      aria-valuemin={0}
      aria-valuemax={maxHealth}
      aria-valuenow={clamped}
      hidden={!visible}
      style={{ ["--health-percent" as string]: healthPercent }}
    >
      <div
        className="battle-health-fill"
        aria-hidden="true"
        style={{ ["--health-percent" as string]: healthPercent }}
      />
      <div
        className="battle-shield-fill"
        aria-hidden="true"
        hidden={shield <= 0}
        style={{ ["--shield-percent" as string]: shieldPercent }}
      />
      <span className="battle-health-value">{clamped}</span>
      <span className="battle-health-effect" aria-hidden="true" />
      <span className="battle-shield" hidden={shield <= 0}>
        {shield > 0 ? `⛨ ${shield} ESCUDO` : ""}
      </span>
    </div>
  );
}
