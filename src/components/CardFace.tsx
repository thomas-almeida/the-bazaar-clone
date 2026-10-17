"use client";

// Markup de carta. A cor de fundo é definida pelo TIER (D..SS); o TIPO aparece
// no rótulo (CRIATURA/FEITIÇO/EQUIPAMENTO). Um selo mostra a letra do tier.
// Os atributos exibidos já consideram o tier; em combate o motor atualiza em
// tempo real (haste). A descrição só aparece no modal.

import { useState } from "react";
import { formatSeconds } from "@/lib/haste";
import { playEvent } from "@/lib/sfx";
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
  synergyBonus?: { bonusValue: number; cooldownMult: number; valueMult?: number };
  /** passiva do mago ativa nesta carta (brilho) */
  passiveActive?: boolean;
}

const DIR_ARROW: Record<string, string> = { left: " ◀ ", right: " ▶ ", both: " ◀  ▶ " };

// Arte da carta. Vídeos só TOCAM quando a carta está ativa (hover); paradas,
// mostram o pôster (quadro estático). Sem isso, um tabuleiro/loja/grade de deck
// renderiza dezenas de <video autoplay loop> decodificando ao mesmo tempo — a
// causa principal de lentidão geral do jogo. O pôster entra instantâneo e o
// vídeo substitui no hover, sem perder a arte animada.
function ArtMedia({ art, active }: { art: CardInstance["art"]; active: boolean }) {
  if (!art) return null;
  if (art.kind === "video") {
    if (!active && art.poster) {
      return <img src={art.poster} alt="" />;
    }
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
  passiveActive,
  ...handlers
}: CardFaceProps) {
  const [hovered, setHovered] = useState(false);
  const { def, tier } = card;
  const isEquipment = def.kind === "equipment";
  const typeLabel = def.piece
    ? "PEÇA"
    : def.kind === "creature" ? "HERÓI" : def.kind === "spell" ? "FEITIÇO" : "EQUIPAMENTO";
  const effectType = def.effectType ?? (def.damage !== undefined ? "damage" : undefined);
  const rawValue = def.effectValue ?? def.damage;
  const bonusValue = synergyBonus?.bonusValue ?? 0;
  const cdMult = synergyBonus?.cooldownMult ?? 1;
  const valueMult = synergyBonus?.valueMult ?? 1;
  const buffed = bonusValue > 0 || cdMult < 1 || valueMult > 1;
  const effectValue =
    rawValue !== undefined ? Math.round((tierValue(rawValue, tier) + bonusValue) * valueMult) : undefined;
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
    passiveActive ? "is-passive-boost" : "",
    def.piece ? "is-piece" : "",
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
      onPointerEnter={(e) => {
        playEvent("ui:board.cardHover");
        setHovered(true);
        handlers.onPointerEnter?.(e);
      }}
      onPointerLeave={(e) => {
        setHovered(false);
        handlers.onPointerLeave?.(e);
      }}
    >
      {def.synergy && (
        <span className="card-synergy-badge" aria-hidden="true">
         {DIR_ARROW[def.synergy.dir]}
        </span>
      )}
      <header className="card-header">
        <span className="card-name">{def.name}</span>
        {/* Custo e tier ancorados juntos no canto superior direito. */}
        <span className="card-topright">
          <span className="card-cost">{def.cost}</span>
          {context !== "preview" && (
            <span className="card-tier-badge" aria-hidden="true">{tierKey(tier)}</span>
          )}
        </span>
      </header>
      <div className="card-art" aria-hidden="true">
        <ArtMedia art={card.art} active={hovered} />
        {/* Efeito prismático: elemento próprio porque ::before/::after de
            .card-art já pertencem ao cooldown. */}
        <span className="card-prism" aria-hidden="true" />
      </div>
      {/* Véu de legibilidade sobre a arte (classe própria: os pseudo-elementos
          da carta já são usados pelo brilho de hover e pelo cooldown). */}
      <div className="card-scrim" aria-hidden="true" />
      <div className="card-info">
        <div className="card-type displa">{typeLabel}</div>
        {def.piece ? (
          <div className="card-stats card-stats-equip">
            <span className="card-haste card-piece-tag">
              🩸 {def.bleed ? `${def.bleed}/s+` : "PEÇA"}
            </span>
          </div>
        ) : isEquipment ? (
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
