"use client";

// Modal de detalhes da carta (ampliada). Porta openCardModal de board.js:
// carta em tamanho grande, nome, tipo, custo/atributos e descrição.
// Fecha pelo botão, clicando no backdrop ou pressionando Escape.

import { useEffect } from "react";
import { useGame } from "@/lib/store";
import { formatSeconds } from "@/lib/haste";
import { tierAccent, tierCooldownSecs, tierKey, tierName, tierValue } from "@/lib/tiers";
import CardFace from "./CardFace";

export default function CardModal({ showTierDetails = true }: { showTierDetails?: boolean }) {
  const card = useGame((s) => s.modalCard);
  const close = useGame((s) => s.closeModal);

  useEffect(() => {
    if (!card) return;
    document.body.classList.add("card-modal-open");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("card-modal-open");
      document.removeEventListener("keydown", onKey);
    };
  }, [card, close]);

  if (!card) return null;
  const { def, tier } = card;
  const displayTier = showTierDetails ? tier : 0;
  const accent = showTierDetails ? tierAccent(tier) : "#b8c0cc";
  const typeLabel =
    def.kind === "creature" ? "CRIATURA" : def.kind === "spell" ? "FEITIÇO" : "EQUIPAMENTO";

  const stats: string[] = [`◈ ${def.cost} MANA`];
  const effectIcon =
    def.effectType === "healing"
      ? "✚"
      : def.effectType === "shield"
        ? "⛨"
        : def.damage !== undefined || def.effectType === "damage"
          ? "⚔"
          : null;
  const rawValue = def.effectValue ?? def.damage;
  const effectValue = rawValue !== undefined ? tierValue(rawValue, displayTier) : undefined;
  if (def.kind === "equipment") {
    const sign = def.target === "enemy" ? "−" : "+";
    if (def.valueHaste) stats.push(`⚡ ${sign}${Math.round(def.valueHaste * 100)}% dano/s`);
    if (def.cooldownHaste) stats.push(`⟳ ${sign}${Math.round(def.cooldownHaste * 100)}% cd/s`);
  } else {
    if (effectIcon && effectValue !== undefined) stats.push(`${effectIcon} ${effectValue}`);
    stats.push(`⏱ ${formatSeconds(tierCooldownSecs(def.cooldown, displayTier))}s`);
  }

  return (
    <div
      className="card-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-card-name"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <button
        className="card-modal-close"
        type="button"
        aria-label="Fechar detalhes da carta"
        onClick={close}
      >
        ×
      </button>
      <div className="card-modal-content" style={{ ["--card-accent" as string]: accent }}>
        <div className="card-modal-art">
          <CardFace
            card={card}
            context={showTierDetails ? "modal" : "preview"}
            extraClass="modal-card"
          />
        </div>
        <section className="card-modal-details">
          <p className="card-modal-eyebrow">
            {showTierDetails ? `${tierKey(tier)} · ${tierName(tier)}` : "DESIGN DA CARTA"}
          </p>
          <h2 id="modal-card-name">{def.name}</h2>
          <p className="card-modal-type">{typeLabel}</p>
          <div className="card-modal-stats">
            {stats.map((s, i) => (
              <span key={i}>{s}</span>
            ))}
          </div>
          <p className="card-modal-description">{def.description}</p>
          {def.synergy && <p className="card-modal-synergy">🔗 {def.synergy.label}</p>}
        </section>
      </div>
    </div>
  );
}
