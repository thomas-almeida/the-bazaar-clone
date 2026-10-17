"use client";

// Tooltip de carta. Mostra descrição e atributos **já com o tier e o reforço do
// mago** — ou seja, os valores que o jogador realmente tinha quando a run
// acabou, e não os do catálogo base. A mesma conta do antigo CardModal
// (tierValue / tierCooldownSecs), em versão compacta.
//
// Dois usos:
//  - `slot` informado (placar): mostra a posição na build e o rodapé "valores
//    finais da run", porque ali a carta é um registro histórico.
//  - `slot` omitido (jogo): é a carta viva, sem posição nem rodapé.

import { formatSeconds } from "@/lib/haste";
import { tierAccent, tierCooldownSecs, tierKey, tierName, tierValue } from "@/lib/tiers";
import type { CardInstance } from "@/lib/types";

export default function CardTooltip({
  card,
  slot,
  hideTier = false,
}: {
  card: CardInstance;
  /** Posição na build final (0..3). Só o placar informa. */
  slot?: number;
  /** Oculta o tier (telas de magos/decks não têm tier). */
  hideTier?: boolean;
}) {
  const { def, tier } = card;
  const typeLabel =
    def.kind === "creature" ? "CRIATURA" : def.kind === "spell" ? "FEITIÇO" : "EQUIPAMENTO";

  const effectIcon =
    def.effectType === "healing"
      ? "✚"
      : def.effectType === "shield"
        ? "⛨"
        : def.damage !== undefined || def.effectType === "damage"
          ? "⚔"
          : null;
  const rawValue = def.effectValue ?? def.damage;
  const effectValue = rawValue !== undefined ? tierValue(rawValue, tier) : undefined;
  const baseValue = rawValue !== undefined ? tierValue(rawValue, 0) : undefined;

  return (
    <div className="card-tip" role="tooltip" style={{ ["--tip-accent" as string]: tierAccent(tier) }}>
      <div className="card-tip-head">
        <strong>{def.name}</strong>
        {!hideTier && (
          <span className="card-tip-tier">
            {tierKey(tier)} · {tierName(tier)}
          </span>
        )}
      </div>

      <p className="card-tip-kind">
        {typeLabel}
        {def.kind === "creature" && def.level !== undefined ? ` · NÍVEL ${def.level}` : ""}
        {slot !== undefined ? ` · SLOT ${slot + 1}` : ""}
      </p>

      <div className="card-tip-stats">
        <span className="card-tip-chip">◈ {def.cost} MANA</span>
        {effectIcon && effectValue !== undefined && (
          <span className="card-tip-chip is-main">
            {effectIcon} {effectValue}
            {baseValue !== undefined && baseValue !== effectValue && (
              <small> (base {baseValue})</small>
            )}
          </span>
        )}
        {def.kind !== "equipment" && (
          <span className="card-tip-chip">⏱ {formatSeconds(tierCooldownSecs(def.cooldown, tier))}s</span>
        )}
        {def.kind === "equipment" && def.valueHaste && (
          <span className="card-tip-chip">
            ⚡ {def.target === "enemy" ? "−" : "+"}
            {Math.round(def.valueHaste * 100)}% dano/s
          </span>
        )}
        {def.kind === "equipment" && def.cooldownHaste && (
          <span className="card-tip-chip">
            ⟳ {def.target === "enemy" ? "−" : "+"}
            {Math.round(def.cooldownHaste * 100)}% cd/s
          </span>
        )}
      </div>

      {def.synergy && <p className="card-tip-synergy">🔗 {def.synergy.label}</p>}

      <p className="card-tip-desc">{def.description}</p>

      {slot !== undefined && <p className="card-tip-foot">Valores finais da run</p>}
    </div>
  );
}
