"use client";

// Markup de carta. A cor de fundo é definida pelo TIER (D..SS); o TIPO aparece
// no rótulo (CRIATURA/FEITIÇO/EQUIPAMENTO). Um selo mostra a letra do tier.
// Os atributos exibidos já consideram o tier; em combate o motor atualiza em
// tempo real (haste). A descrição só aparece no modal.

import { formatSeconds } from "@/lib/haste";
import { tierClass, tierKey, tierCooldownSecs, tierValue } from "@/lib/tiers";
import type { CardInstance } from "@/lib/types";

const EFFECT_META: Record<string, { icon: string; className: string }> = {
  damage: { icon: "⚔", className: "damage" },
  healing: { icon: "✚", className: "healing" },
  shield: { icon: "⛨", className: "shield" },
};

function pct(n?: number): string {
  return `${Math.round((n ?? 0) * 100)}%`;
}

function hasteLabel(def: CardInstance["def"]): string {
  const sign = def.target === "enemy" ? "−" : "+";
  const icon = def.target === "enemy" ? "🐌" : "⚡";
  const parts: string[] = [];
  if (def.valueHaste) parts.push(`${sign}${pct(def.valueHaste)} dano`);
  if (def.cooldownHaste) parts.push(`${sign}${pct(def.cooldownHaste)} cd`);
  return `${icon} ${parts.join("  ")}`;
}

export interface CardFaceProps {
  card: CardInstance;
  context?: "hand" | "slot" | "combat" | "modal" | "preview";
  className?: string;
  style?: React.CSSProperties;
  extraClass?: string;
  onPointerDown?: React.PointerEventHandler<HTMLElement>;
  onPointerMove?: React.PointerEventHandler<HTMLElement>;
  onPointerUp?: React.PointerEventHandler<HTMLElement>;
  onPointerCancel?: React.PointerEventHandler<HTMLElement>;
  onPointerEnter?: React.PointerEventHandler<HTMLElement>;
  onPointerLeave?: React.PointerEventHandler<HTMLElement>;
  onClick?: React.MouseEventHandler<HTMLElement>;
  innerRef?: React.Ref<HTMLElement>;
  /** bônus de sinergia recebido dos vizinhos (contexto de slot) */
  synergyBonus?: { bonusValue: number; cooldownMult: number };
}

const DIR_ARROW: Record<string, string> = { left: "◀", right: "▶", both: "◀▶" };

function ArtMedia({ art }: { art: CardInstance["art"] }) {
  if (!art) return null;
  if (art.kind === "video") {
    return (
      <video
        src={art.src}
        poster={art.poster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
    );
  }
  return <img src={art.src} alt="" />;
}

export default function CardFace({
  card,
  context = "hand",
  className,
  style,
  extraClass,
  innerRef,
  synergyBonus,
  ...handlers
}: CardFaceProps) {
  const { def, tier } = card;
  const isEquipment = def.kind === "equipment";
  const typeLabel =
    def.kind === "creature" ? "CRIATURA" : def.kind === "spell" ? "FEITIÇO" : "EQUIPAMENTO";
  const effectType = def.effectType ?? (def.damage !== undefined ? "damage" : undefined);
  const rawValue = def.effectValue ?? def.damage;
  const bonusValue = synergyBonus?.bonusValue ?? 0;
  const cdMult = synergyBonus?.cooldownMult ?? 1;
  const buffed = bonusValue > 0 || cdMult < 1;
  const effectValue = rawValue !== undefined ? tierValue(rawValue, tier) + bonusValue : undefined;
  const effectIcon = effectType ? EFFECT_META[effectType].icon : null;
  const cooldown = formatSeconds(tierCooldownSecs(def.cooldown, tier) * cdMult);
  const equipHaste = def.valueHaste || def.cooldownHaste;
  const showEffectPop =
    (context === "slot" || context === "combat") &&
    effectType !== undefined &&
    effectValue !== undefined;

  const classes = [
    "hand-card",
    "card-kind-" + def.kind,
    context === "preview" ? "card-design-preview" : tierClass(tier),
    def.synergy ? "has-synergy" : "",
    buffed ? "is-synergy-buffed" : "",
    extraClass ?? "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      ref={innerRef}
      className={classes}
      style={style}
      data-card-id={card.id}
      data-card-name={def.name}
      {...handlers}
    >
      {context !== "preview" && (
        <span className="card-tier-badge" aria-hidden="true">{tierKey(tier)}</span>
      )}
      {def.synergy && (
        <span className="card-synergy-badge" aria-hidden="true">
          🔗 {DIR_ARROW[def.synergy.dir]}
        </span>
      )}
      <header className="card-header">
        <span>{def.name}</span>
        <span className="card-cost">{def.cost}</span>
      </header>
      <div className="card-art" aria-hidden="true">
        <ArtMedia art={card.art} />
      </div>
      <div className="card-info">
        <div className="card-type">{typeLabel}</div>
        {def.kind === "creature" && context !== "preview" && (
          <div className="card-level">LEVEL {def.level}</div>
        )}
        {isEquipment ? (
          <div className="card-stats card-stats-equip">
            <span className="card-haste">
              {equipHaste ? hasteLabel(def) : def.synergy ? `🔗 ${DIR_ARROW[def.synergy.dir]}` : "—"}
            </span>
          </div>
        ) : (
          <div className="card-stats">
            {effectType && effectValue !== undefined && (
              <span className="card-stat-value" data-effect-icon={effectIcon ?? ""}>
                {effectIcon} {effectValue}
              </span>
            )}
            <span className="card-cooldown">⏱ {cooldown}s</span>
          </div>
        )}
      </div>
      {showEffectPop && effectType && effectValue !== undefined && (
        <span
          className={`card-effect-pop card-effect-pop--${EFFECT_META[effectType].className}`}
          aria-hidden="true"
        >
          <span className="card-effect-icon">{EFFECT_META[effectType].icon}</span>
          <span className="card-effect-value">{effectValue}</span>
        </span>
      )}
    </article>
  );
}
